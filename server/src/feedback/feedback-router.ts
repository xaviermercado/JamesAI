import type { Request, Response } from 'express';
import express from 'express';

import { AUTH_CSRF_HEADER_NAME, AUTH_SESSION_COOKIE_NAME, createCsrfToken, timingSafeStringEqual } from '../auth/auth-crypto';
import type { AuthRepositoryLike } from '../auth/auth-repository';
import { AuthService } from '../auth/auth-service';
import type { AppConfig } from '../config/env';
import type { FeedbackRepositoryLike } from './feedback-repository';
import { submitFeedbackSchema } from './feedback-schemas';
import { logger } from '../utils/logger';

function readCookieHeader(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) return decodeURIComponent(valueParts.join('='));
  }
  return null;
}

function isAllowedOrigin(origin: string | undefined, config: AppConfig): boolean {
  if (!origin || !config.frontendOrigin) return true;
  return origin === config.frontendOrigin;
}

function requireCsrf(req: Request, res: Response, sessionTokenHash: string, config: AppConfig): boolean {
  const csrfToken = req.get(AUTH_CSRF_HEADER_NAME)?.trim() || null;
  if (!csrfToken) { res.status(403).json({ error: 'Forbidden' }); return false; }
  const expected = createCsrfToken(sessionTokenHash, config.sessionTokenPepper ?? '');
  if (!timingSafeStringEqual(expected, csrfToken)) { res.status(403).json({ error: 'Forbidden' }); return false; }
  return true;
}

function toApiFeedback(row: { tmdb_id: number; media_type: string; feedback_type: string; updated_at: Date }) {
  return {
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    feedbackType: row.feedback_type,
    updatedAt: row.updated_at,
  };
}

export function createFeedbackRouter(
  config: AppConfig,
  authRepository: AuthRepositoryLike,
  feedbackRepository: FeedbackRepositoryLike,
) {
  const router = express.Router();
  const authService = new AuthService(authRepository, config);

  router.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !isAllowedOrigin(req.headers.origin, config)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  });

  // GET /api/feedback — list all feedback for the current user.
  router.get('/', async (req: Request, res: Response) => {
    const sessionToken = readCookieHeader(req.headers.cookie, AUTH_SESSION_COOKIE_NAME);
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) return res.status(401).json({ error: 'Unauthorized' });

      const feedback = await feedbackRepository.listFeedback(restored.identity.userId);
      return res.json({ feedback: feedback.map(toApiFeedback) });
    } catch (error) {
      logger.error('feedback.route_error', { route: 'GET /', error });
      return res.status(500).json({ error: 'Unable to load feedback right now' });
    }
  });

  // POST /api/feedback — create or update feedback for a title.
  router.post('/', async (req: Request, res: Response) => {
    const sessionToken = readCookieHeader(req.headers.cookie, AUTH_SESSION_COOKIE_NAME);
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) return res.status(401).json({ error: 'Unauthorized' });
      if (!requireCsrf(req, res, restored.identity.sessionTokenHash, config)) return undefined;

      const parsed = submitFeedbackSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

      const { tmdbId, mediaType, feedbackType, genres, originalLanguage } = parsed.data;
      const genresJson = genres && genres.length > 0 ? JSON.stringify(genres) : null;

      const saved = await feedbackRepository.upsertFeedback(
        restored.identity.userId,
        tmdbId,
        mediaType,
        feedbackType,
        { genresJson, originalLanguage: originalLanguage ?? null },
      );

      return res.json({ feedback: toApiFeedback(saved) });
    } catch (error) {
      logger.error('feedback.route_error', { route: 'POST /', error });
      return res.status(500).json({ error: 'Unable to save feedback right now' });
    }
  });

  // DELETE /api/feedback/:tmdbId/:mediaType — remove feedback for a title.
  router.delete('/:tmdbId/:mediaType', async (req: Request, res: Response) => {
    const sessionToken = readCookieHeader(req.headers.cookie, AUTH_SESSION_COOKIE_NAME);
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) return res.status(401).json({ error: 'Unauthorized' });
      if (!requireCsrf(req, res, restored.identity.sessionTokenHash, config)) return undefined;

      const tmdbId = Number(req.params.tmdbId);
      const mediaType = req.params.mediaType as string;
      if (!Number.isInteger(tmdbId) || tmdbId <= 0) return res.status(400).json({ error: 'Invalid title ID' });
      if (mediaType !== 'movie' && mediaType !== 'tv') return res.status(400).json({ error: 'Invalid media type' });

      await feedbackRepository.removeFeedback(restored.identity.userId, tmdbId, mediaType);
      return res.json({ ok: true });
    } catch (error) {
      logger.error('feedback.route_error', { route: 'DELETE /:id/:type', error });
      return res.status(500).json({ error: 'Unable to remove feedback right now' });
    }
  });

  // DELETE /api/feedback — clear ALL feedback for the current user (requires explicit confirmation).
  router.delete('/', async (req: Request, res: Response) => {
    const sessionToken = readCookieHeader(req.headers.cookie, AUTH_SESSION_COOKIE_NAME);
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) return res.status(401).json({ error: 'Unauthorized' });
      if (!requireCsrf(req, res, restored.identity.sessionTokenHash, config)) return undefined;

      const count = await feedbackRepository.clearAllFeedback(restored.identity.userId);
      return res.json({ ok: true, count });
    } catch (error) {
      logger.error('feedback.route_error', { route: 'DELETE /', error });
      return res.status(500).json({ error: 'Unable to clear feedback right now' });
    }
  });

  return router;
}
