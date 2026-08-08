import { XMLParser } from 'fast-xml-parser';

import { buildSeenTitleKey, normalizeLetterboxdTitle, sanitizeReleaseYear } from './title-normalization';

export interface LetterboxdSeenTitleInput {
  normalizedTitle: string;
  releaseYear: number | null;
  watchedAt: Date | null;
  isRewatch: boolean;
  ratingTenths: number | null;
  liked: boolean;
  rawTitle: string;
}

export interface LetterboxdRssFetchMeta {
  etag?: string | null;
  lastModified?: string | null;
}

export interface LetterboxdRssFetchResult {
  status: 'not_modified' | 'ok' | 'error';
  httpStatus?: number;
  errorCode?: string;
  errorMessage?: string;
  etag?: string | null;
  lastModified?: string | null;
  titles: LetterboxdSeenTitleInput[];
}

const USER_AGENT = 'ScoutyLetterboxdRSS/1.0';
const MAX_FEED_BYTES = 1_500_000;

function parseTitleYearFallback(value: string): { title: string; year: number | null } {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*?)(?:,\s*(\d{4}))?(?:\s+[★\u00BD]+.*)?$/u);
  if (!match) {
    return { title: trimmed, year: null };
  }
  const title = match[1]?.trim() || trimmed;
  return {
    title,
    year: sanitizeReleaseYear(match[2] ?? null),
  };
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildLetterboxdRssUrl(username: string): string {
  return `https://letterboxd.com/${encodeURIComponent(username)}/rss/`;
}

export function parseLetterboxdRss(xml: string): LetterboxdSeenTitleInput[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
  });
  const doc = parser.parse(xml) as {
    rss?: {
      channel?: {
        item?: Array<Record<string, unknown>> | Record<string, unknown>;
      };
    };
  };

  const items = toArray(doc.rss?.channel?.item);
  const deduped = new Map<string, LetterboxdSeenTitleInput>();

  for (const item of items) {
    const namespacedTitle = asString(item['letterboxd:filmTitle']);
    const namespacedYear = sanitizeReleaseYear(item['letterboxd:filmYear']);
    const fallback = parseTitleYearFallback(asString(item.title) ?? '');
    const rawTitle = namespacedTitle ?? fallback.title;
    const normalizedTitle = normalizeLetterboxdTitle(rawTitle);
    if (!normalizedTitle) {
      continue;
    }

    const releaseYear = namespacedYear ?? fallback.year;
    const watchedAtRaw = asString(item.pubDate);
    const watchedAt = watchedAtRaw ? new Date(watchedAtRaw) : null;
    const safeWatchedAt = watchedAt && !Number.isNaN(watchedAt.getTime()) ? watchedAt : null;
    const description = asString(item.description) ?? '';
    const isRewatch = /rewatch/i.test(description);
    const liked = /❤️|\bhearts?\b/i.test(description);

    // Ratings are represented in stars; store as tenths where possible.
    const ratingMatch = description.match(/([0-5](?:\.5)?)\s*stars?/i);
    const ratingTenths = ratingMatch ? Math.round(Number(ratingMatch[1]) * 2) : null;

    const key = buildSeenTitleKey(rawTitle, releaseYear);
    deduped.set(key, {
      normalizedTitle,
      releaseYear,
      watchedAt: safeWatchedAt,
      isRewatch,
      ratingTenths,
      liked,
      rawTitle,
    });
  }

  return [...deduped.values()];
}

export async function fetchAndParseLetterboxdRss(
  username: string,
  meta?: LetterboxdRssFetchMeta,
): Promise<LetterboxdRssFetchResult> {
  const url = buildLetterboxdRssUrl(username);
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'letterboxd.com') {
    return {
      status: 'error',
      errorCode: 'invalid_feed_url',
      errorMessage: 'Invalid Letterboxd RSS URL',
      titles: [],
    };
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 8_000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      signal: abortController.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
        ...(meta?.etag ? { 'if-none-match': meta.etag } : {}),
        ...(meta?.lastModified ? { 'if-modified-since': meta.lastModified } : {}),
      },
    });

    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');

    if (response.status === 304) {
      return { status: 'not_modified', httpStatus: 304, etag, lastModified, titles: [] };
    }
    if (!response.ok) {
      return {
        status: 'error',
        httpStatus: response.status,
        errorCode: response.status === 404 ? 'feed_not_found' : 'feed_http_error',
        errorMessage: `Letterboxd feed request failed with status ${response.status}`,
        etag,
        lastModified,
        titles: [],
      };
    }

    const contentLengthRaw = response.headers.get('content-length');
    if (contentLengthRaw) {
      const contentLength = Number(contentLengthRaw);
      if (Number.isFinite(contentLength) && contentLength > MAX_FEED_BYTES) {
        return {
          status: 'error',
          errorCode: 'feed_too_large',
          errorMessage: 'Letterboxd feed exceeds maximum allowed size',
          etag,
          lastModified,
          titles: [],
        };
      }
    }

    const xml = await response.text();
    if (Buffer.byteLength(xml, 'utf8') > MAX_FEED_BYTES) {
      return {
        status: 'error',
        errorCode: 'feed_too_large',
        errorMessage: 'Letterboxd feed exceeds maximum allowed size',
        etag,
        lastModified,
        titles: [],
      };
    }

    const titles = parseLetterboxdRss(xml);
    return { status: 'ok', httpStatus: response.status, etag, lastModified, titles };
  } catch (error) {
    const timeoutLike = error instanceof Error && error.name === 'AbortError';
    return {
      status: 'error',
      errorCode: timeoutLike ? 'feed_timeout' : 'feed_request_failed',
      errorMessage: timeoutLike ? 'Letterboxd feed request timed out' : 'Letterboxd feed request failed',
      titles: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}
