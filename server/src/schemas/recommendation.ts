import { z } from 'zod';

export const recommendationSchema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  mediaType: z.enum(['movie', 'tv']).optional(),
  maxRuntime: z.number().int().positive().nullable().optional(),
  country: z.string().trim().max(100).optional(),
  streamingServices: z.array(z.string().trim().min(1)).optional(),
  excludedMovieIds: z.array(z.number().int().positive()).optional(),
});

export type RecommendationInput = z.infer<typeof recommendationSchema>;
