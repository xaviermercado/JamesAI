import type { Request, Response } from 'express';
import express from 'express';

import { getSessionTokenFromRequest } from '../auth/auth-request';
import { AUTH_CSRF_HEADER_NAME, createCsrfToken, timingSafeStringEqual } from '../auth/auth-crypto';
import type { AuthRepositoryLike } from '../auth/auth-repository';
import { AuthService } from '../auth/auth-service';
import type { AppConfig } from '../config/env';
import type { TmdbService } from '../services/tmdb-service';
import type { MediaType } from '../types/recommendations';
import { logger } from '../utils/logger';
import type { LibraryRepositoryLike, StoredLibraryTitle } from './library-repository';
import { libraryActionSchema, libraryStateLookupSchema, paginationSchema } from './library-schemas';
import type { ProductAnalyticsService } from '../analytics/product-analytics';

function isAllowedOrigin(origin: string | undefined, config: AppConfig): boolean {
  if (!origin || !config.frontendOrigin) return true;
  return origin === config.frontendOrigin;
}

function requireCsrf(req: Request, res: Response, sessionTokenHash: string, config: AppConfig): boolean {
  const csrfToken = req.get(AUTH_CSRF_HEADER_NAME)?.trim() || null;
  if (!csrfToken) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  const expected = createCsrfToken(sessionTokenHash, config.sessionTokenPepper ?? '');
  if (!timingSafeStringEqual(expected, csrfToken)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

function toApiLibraryState(row: StoredLibraryTitle) {
  return {
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    status: row.library_status,
    addedAt: row.added_at,
    watchedAt: row.watched_at,
    updatedAt: row.updated_at,
  };
}

function toMetadataFallback(tmdbId: number, mediaType: MediaType) {
  return {
    tmdbId,
    mediaType,
    title: `Title #${tmdbId}`,
    posterUrl: '',
    releaseYear: 0,
    runtimeMinutes: 0,
    tmdbRating: 0,
    genres: [],
    providers: [],
    country: '',
    metadataUnavailable: true,
  };
}

export function createLibraryRouter(
  config: AppConfig,
  authRepository: AuthRepositoryLike,
  libraryRepository: LibraryRepositoryLike,
  tmdbService: TmdbService,
  productAnalytics?: ProductAnalyticsService | null,
) {
  const router = express.Router();
  const authService = new AuthService(authRepository, config);

  router.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !isAllowedOrigin(req.headers.origin, config)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.setHeader('Cache-Control', 'private, no-store');
    next();
  });

  async function requireIdentity(req: Request, res: Response) {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }

    const restored = await authService.restoreSession(sessionToken);
    if (!restored.authenticated || !restored.identity) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }

    return restored.identity;
  }

  router.get('/watchlist', async (req: Request, res: Response) => {
    try {
      const identity = await requireIdentity(req, res);
      if (!identity) return undefined;

      const pagination = paginationSchema.safeParse(req.query);
      if (!pagination.success) {
        return res.status(400).json({ error: pagination.error.flatten().fieldErrors });
      }

      const { rows, total } = await libraryRepository.listLibrary(identity.userId, {
        status: 'watchlist',
        page: pagination.data.page,
        pageSize: pagination.data.pageSize,
        sort: pagination.data.sort,
      });

      const metadata = await tmdbService.getTitleSummaries(
        rows.map((row) => ({ tmdbId: row.tmdb_id, mediaType: row.media_type })),
      );

      const metadataByKey = new Map(metadata.map((item) => [`${item.mediaType}:${item.tmdbMovieId}`, item]));

      return res.json({
        page: pagination.data.page,
        pageSize: pagination.data.pageSize,
        total,
        items: rows.map((row) => ({
          ...toApiLibraryState(row),
          metadata: metadataByKey.get(`${row.media_type}:${row.tmdb_id}`) ?? toMetadataFallback(row.tmdb_id, row.media_type),
        })),
      });
    } catch (error) {
      logger.error('library.route_error', { route: 'GET /watchlist', error });
      return res.status(500).json({ error: 'Unable to load watchlist right now' });
    }
  });

  router.get('/watched', async (req: Request, res: Response) => {
    try {
      const identity = await requireIdentity(req, res);
      if (!identity) return undefined;

      const pagination = paginationSchema.safeParse(req.query);
      if (!pagination.success) {
        return res.status(400).json({ error: pagination.error.flatten().fieldErrors });
      }

      const { rows, total } = await libraryRepository.listLibrary(identity.userId, {
        status: 'watched',
        page: pagination.data.page,
        pageSize: pagination.data.pageSize,
        sort: pagination.data.sort,
      });

      const metadata = await tmdbService.getTitleSummaries(
        rows.map((row) => ({ tmdbId: row.tmdb_id, mediaType: row.media_type })),
      );

      const metadataByKey = new Map(metadata.map((item) => [`${item.mediaType}:${item.tmdbMovieId}`, item]));

      return res.json({
        page: pagination.data.page,
        pageSize: pagination.data.pageSize,
        total,
        items: rows.map((row) => ({
          ...toApiLibraryState(row),
          metadata: metadataByKey.get(`${row.media_type}:${row.tmdb_id}`) ?? toMetadataFallback(row.tmdb_id, row.media_type),
        })),
      });
    } catch (error) {
      logger.error('library.route_error', { route: 'GET /watched', error });
      return res.status(500).json({ error: 'Unable to load watched titles right now' });
    }
  });

  router.post('/states', async (req: Request, res: Response) => {
    try {
      const identity = await requireIdentity(req, res);
      if (!identity) return undefined;

      const parsed = libraryStateLookupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }

      const states = await libraryRepository.listStates(identity.userId, parsed.data.titles);

      return res.json({
        states: states.map(toApiLibraryState),
      });
    } catch (error) {
      logger.error('library.route_error', { route: 'POST /states', error });
      return res.status(500).json({ error: 'Unable to load library states right now' });
    }
  });

  router.post('/action', async (req: Request, res: Response) => {
    try {
      const identity = await requireIdentity(req, res);
      if (!identity) return undefined;
      if (!requireCsrf(req, res, identity.sessionTokenHash, config)) return undefined;

      const parsed = libraryActionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }

      const { tmdbId, mediaType, action } = parsed.data;

      if (action === 'remove') {
        await libraryRepository.removeTitle(identity.userId, tmdbId, mediaType);
        return res.json({ ok: true, state: null });
      }

      let row: StoredLibraryTitle;
      if (action === 'add_watchlist') {
        row = await libraryRepository.upsertWatchlist(identity.userId, tmdbId, mediaType);
      } else if (action === 'mark_watched') {
        row = await libraryRepository.markWatched(identity.userId, tmdbId, mediaType);
      } else {
        row = await libraryRepository.markUnwatched(identity.userId, tmdbId, mediaType);
      }

      if (action === 'add_watchlist' && parsed.data.recommendationRequestId) {
        await productAnalytics?.record({
          eventName: 'recommendation_saved',
          recommendationCorrelationId: parsed.data.recommendationRequestId,
          mediaType,
          authenticated: true,
          sourceSurface: 'recommendations',
        });
      }

      return res.json({ ok: true, state: toApiLibraryState(row) });
    } catch (error) {
      logger.error('library.route_error', { route: 'POST /action', error });
      return res.status(500).json({ error: 'Unable to update library right now' });
    }
  });

  router.delete('/watchlist', async (req: Request, res: Response) => {
    try {
      const identity = await requireIdentity(req, res);
      if (!identity) return undefined;
      if (!requireCsrf(req, res, identity.sessionTokenHash, config)) return undefined;

      const count = await libraryRepository.clearWatchlist(identity.userId);
      return res.json({ ok: true, count });
    } catch (error) {
      logger.error('library.route_error', { route: 'DELETE /watchlist', error });
      return res.status(500).json({ error: 'Unable to clear watchlist right now' });
    }
  });

  router.delete('/watched', async (req: Request, res: Response) => {
    try {
      const identity = await requireIdentity(req, res);
      if (!identity) return undefined;
      if (!requireCsrf(req, res, identity.sessionTokenHash, config)) return undefined;

      const count = await libraryRepository.clearWatched(identity.userId);
      return res.json({ ok: true, count });
    } catch (error) {
      logger.error('library.route_error', { route: 'DELETE /watched', error });
      return res.status(500).json({ error: 'Unable to clear watched history right now' });
    }
  });

  return router;
}
