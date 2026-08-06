import type { Request, Response } from 'express';
import express from 'express';

import { AUTH_SESSION_COOKIE_NAME } from '../auth/auth-crypto';
import type { AuthRepositoryLike } from '../auth/auth-repository';
import { AuthService } from '../auth/auth-service';
import type { AppConfig } from '../config/env';
import type { ProfileRepositoryLike } from '../profile/profile-repository';
import { resolvePreferences } from '../recommendations/preference-resolver';
import type { SavedPreferences } from '../recommendations/preference-resolver';
import { recommendationSchema } from '../schemas/recommendation';
import { TmdbService } from '../services/tmdb-service';
import type { RecommendationRequest } from '../types/recommendations';
import { logger } from '../utils/logger';

function readCookieHeader(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) return decodeURIComponent(valueParts.join('='));
  }
  return null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

async function loadSavedPreferences(
  req: Request,
  authRepo: AuthRepositoryLike,
  profileRepo: ProfileRepositoryLike,
  config: AppConfig,
): Promise<SavedPreferences | null> {
  const sessionToken = readCookieHeader(req.headers.cookie, AUTH_SESSION_COOKIE_NAME);
  if (!sessionToken) return null;

  try {
    const authService = new AuthService(authRepo, config);
    const restored = await authService.restoreSession(sessionToken);
    if (!restored.authenticated || !restored.identity) return null;

    const { userId } = restored.identity;
    const [profile, contentLanguages, streamingServices] = await Promise.all([
      profileRepo.findByUserId(userId),
      profileRepo.listContentLanguages(userId),
      profileRepo.listStreamingServices(userId),
    ]);

    return {
      marketCode: profile?.country_code ?? null,
      providerIds: streamingServices.map((s) => s.providerId),
      languageCodes: contentLanguages
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((l) => l.languageCode),
    };
  } catch (error) {
    // Non-fatal: if preference loading fails, proceed with anonymous behavior.
    logger.error('recommendations.preference_load_failed', { error });
    return null;
  }
}

export function createRecommendationsRouter(
  tmdbService: TmdbService,
  config?: AppConfig | null,
  authRepo?: AuthRepositoryLike | null,
  profileRepo?: ProfileRepositoryLike | null,
) {
  const router = express.Router();

  router.post('/recommendations', async (req: Request, res: Response) => {
    try {
      const parsed = recommendationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }

      // Load saved preferences if authenticated (non-fatal on failure).
      let savedPrefs: SavedPreferences | null = null;
      if (config && authRepo && profileRepo) {
        savedPrefs = await loadSavedPreferences(req, authRepo, profileRepo, config);
      }

      // Resolve effective preferences by merging saved + temporary overrides.
      const effective = resolvePreferences(savedPrefs, {
        country: parsed.data.country,
        providerIds: parsed.data.providerIds,
        originalLanguages: parsed.data.originalLanguages,
        streamingServices: parsed.data.streamingServices,
      });

      const payload: RecommendationRequest = {
        description: parsed.data.description,
        mediaType: parsed.data.mediaType,
        maxRuntime: parsed.data.maxRuntime ?? undefined,
        country: effective.effectiveMarket,
        providerIds: effective.effectiveProviderIds,
        originalLanguages: effective.effectiveLanguages,
        streamingServices: effective.legacyStreamingServices,
        excludedMovieIds: parsed.data.excludedMovieIds,
      };

      const result = await tmdbService.getRecommendations(payload);

      return res.json({
        ...result,
        preferencesApplied: effective.savedPreferencesApplied,
        preferenceContext: effective.savedPreferencesApplied
          ? {
              market: effective.effectiveMarket,
              providerCount: effective.effectiveProviderIds?.length ?? 0,
              languageCount: effective.effectiveLanguages?.length ?? 0,
            }
          : undefined,
      });
    } catch (error) {
      logger.error('recommendations.route_error', { error });
      return res.status(502).json({ error: getErrorMessage(error) });
    }
  });

  router.get('/movies/:movieId/providers', async (req: Request, res: Response) => {
    try {
      const { movieId } = req.params;
      const movieIdNumber = Number(movieId);
      if (!Number.isInteger(movieIdNumber)) {
        return res.status(400).json({ error: 'movieId must be an integer' });
      }

      const mediaType = (req.query.mediaType as 'movie' | 'tv' | undefined) ?? 'movie';
      const providers = await tmdbService.getMovieProviders(
        movieIdNumber,
        mediaType,
        req.query.country as string | undefined,
      );
      return res.json({ movieId: movieIdNumber, providers });
    } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  return router;
}
