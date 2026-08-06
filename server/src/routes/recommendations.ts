import type { Request, Response } from 'express';
import express from 'express';

import { AUTH_SESSION_COOKIE_NAME } from '../auth/auth-crypto';
import type { AuthRepositoryLike } from '../auth/auth-repository';
import { AuthService } from '../auth/auth-service';
import type { AppConfig } from '../config/env';
import { type FeedbackRepositoryLike } from '../feedback/feedback-repository';
import { type LibraryRepositoryLike } from '../library/library-repository';
import { streamingServiceCatalog } from '../profile/reference-data';
import type { ProfileRepositoryLike } from '../profile/profile-repository';
import { applyPersonalizedRanking } from '../recommendations/personalized-ranking';
import { resolvePreferences } from '../recommendations/preference-resolver';
import type { SavedPreferences } from '../recommendations/preference-resolver';
import { calculateTasteSignals } from '../recommendations/taste-signals';
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

function hasExplicitRewatchIntent(description: string): boolean {
  const text = description.toLowerCase();
  return /(rewatch|watch again|seen before|already seen|again|revisit)/.test(text);
}

function applyProviderPriorityOrdering<T extends { providers: string[]; tmdbMovieId: number }>(
  recommendations: T[],
  orderedProviderNames: string[],
): T[] {
  if (orderedProviderNames.length === 0) return recommendations;

  const priorities = new Map(orderedProviderNames.map((name, index) => [name.toLowerCase(), index]));

  return [...recommendations]
    .map((item, index) => {
      const ranks = item.providers
        .map((provider) => priorities.get(provider.toLowerCase()))
        .filter((rank): rank is number => typeof rank === 'number');
      const bestRank = ranks.length > 0 ? Math.min(...ranks) : Number.MAX_SAFE_INTEGER;
      return { item, index, bestRank };
    })
    .sort((a, b) => {
      if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank;
      return a.index - b.index;
    })
    .map((row) => row.item);
}

interface AuthRecommendationContext {
  userId: string;
  personalizationEnabled: boolean;
  savedPreferences: SavedPreferences;
}

async function loadAuthRecommendationContext(
  req: Request,
  authRepo: AuthRepositoryLike,
  profileRepo: ProfileRepositoryLike,
  config: AppConfig,
): Promise<AuthRecommendationContext | null> {
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
      userId,
      personalizationEnabled: profile ? profile.personalization_enabled !== 0 : true,
      savedPreferences: {
        marketCode: profile?.country_code ?? null,
        providerIds: streamingServices.map((s) => s.providerId),
        languageCodes: contentLanguages
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((l) => l.languageCode),
      },
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
  feedbackRepo?: FeedbackRepositoryLike | null,
  libraryRepo?: LibraryRepositoryLike | null,
) {
  const router = express.Router();

  router.post('/recommendations', async (req: Request, res: Response) => {
    try {
      const parsed = recommendationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }

      // Load saved preferences if authenticated (non-fatal on failure).
      let authContext: AuthRecommendationContext | null = null;
      if (config && authRepo && profileRepo) {
        authContext = await loadAuthRecommendationContext(req, authRepo, profileRepo, config);
      }
      const savedPrefs: SavedPreferences | null = authContext?.savedPreferences ?? null;

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

      // Default repetition control: suppress watched titles unless explicit rewatch intent is present.
      if (authContext && libraryRepo && !hasExplicitRewatchIntent(parsed.data.description)) {
        try {
          const watchedIds = await libraryRepo.listWatchedTitleIds(
            authContext.userId,
            parsed.data.mediaType ?? 'movie',
            300,
          );
          if (watchedIds.length > 0) {
            const mergedExcluded = new Set([...(payload.excludedMovieIds ?? []), ...watchedIds]);
            payload.excludedMovieIds = [...mergedExcluded].slice(0, 1000);
          }
        } catch (error) {
          logger.error('recommendations.watched_suppression_failed', { error });
        }
      }

      const result = await tmdbService.getRecommendations(payload);
      let personalizedRecommendations = result.recommendations;

      // Apply saved provider order as a soft tie-breaker only when saved provider preferences are active.
      if (effective.source.providers === 'saved' && effective.effectiveProviderIds && effective.effectiveProviderIds.length > 0) {
        const providerNames = effective.effectiveProviderIds
          .map((providerId) => streamingServiceCatalog.find((provider) => provider.providerId === providerId)?.providerName)
          .filter((name): name is string => Boolean(name));
        personalizedRecommendations = applyProviderPriorityOrdering(personalizedRecommendations, providerNames);
      }

      let feedbackPersonalizationApplied = false;

      if (authContext?.personalizationEnabled && feedbackRepo) {
        try {
          const [feedbackEntries, ratedTitles] = await Promise.all([
            feedbackRepo.listFeedbackForSignals(authContext.userId),
            feedbackRepo.listRatedTitleKeys(authContext.userId, 200),
          ]);
          const signals = calculateTasteSignals(feedbackEntries);

          if (signals.hasMinimumEvidence) {
            const reranked = applyPersonalizedRanking(result.recommendations, signals, {
              mediaType: payload.mediaType ?? 'movie',
              explicitLanguageFilter: parsed.data.originalLanguages,
              ratedTitleKeys: new Set(ratedTitles.map((item) => `${item.mediaType}:${item.tmdbId}`)),
            });

            const changedOrder = reranked.some(
              (item, index) => item.tmdbMovieId !== result.recommendations[index]?.tmdbMovieId,
            );
            if (changedOrder) {
              personalizedRecommendations = reranked;
              feedbackPersonalizationApplied = true;
            }
          }
        } catch (error) {
          // Non-fatal: recommendations continue with Milestone 4 baseline behavior.
          logger.error('recommendations.personalization_failed', { error });
        }
      }

      return res.json({
        ...result,
        recommendations: personalizedRecommendations,
        preferencesApplied: effective.savedPreferencesApplied,
        feedbackPersonalizationApplied,
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
