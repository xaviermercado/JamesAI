import type { Request, Response } from 'express';
import express from 'express';

import { recommendationSchema } from '../schemas/recommendation';
import { TmdbService } from '../services/tmdb-service';
import type { RecommendationRequest } from '../types/recommendations';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

const router = express.Router();

export function createRecommendationsRouter(tmdbService: TmdbService) {
  router.post('/recommendations', async (req: Request, res: Response) => {
    try {
      const parsed = recommendationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }

      const payload: RecommendationRequest = {
        description: parsed.data.description,
        mediaType: parsed.data.mediaType,
        maxRuntime: parsed.data.maxRuntime ?? undefined,
        country: parsed.data.country,
        streamingServices: parsed.data.streamingServices,
        excludedMovieIds: parsed.data.excludedMovieIds,
      };

      const recommendations = await tmdbService.getRecommendations(payload);
      return res.json(recommendations);
    } catch (error) {
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
