export interface NormalizedLetterboxdTitle {
  normalizedTitle: string;
  releaseYear: number | null;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeLetterboxdTitle(title: string): string {
  const collapsed = collapseWhitespace(title).toLowerCase();
  // Keep Unicode letters and numbers, collapse punctuation into spaces.
  return collapsed.replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function sanitizeReleaseYear(year: unknown): number | null {
  if (typeof year !== 'number' && typeof year !== 'string') {
    return null;
  }
  const parsed = Number(String(year).trim());
  if (!Number.isInteger(parsed)) {
    return null;
  }
  if (parsed < 1870 || parsed > 2100) {
    return null;
  }
  return parsed;
}

export function buildSeenTitleKey(title: string, year: number | null | undefined): string {
  return `${normalizeLetterboxdTitle(title)}|${year ?? 0}`;
}
