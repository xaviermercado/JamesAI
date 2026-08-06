import { z } from 'zod';

import { allowedLanguageCodes, allowedProviderIds } from '../profile/reference-data';

export const recommendationSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(1000, 'Description too long'),
  mediaType: z.enum(['movie', 'tv']).optional(),
  maxRuntime: z.number().int().positive().nullable().optional(),
  country: z.string().trim().toUpperCase().max(2).regex(/^[A-Z]{0,2}$/).optional(),
  // Legacy name-based services (anonymous / old clients). Not validated against catalog — server maps.
  streamingServices: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  // Temporary TMDB provider IDs. [] = explicitly "any service".
  providerIds: z
    .array(z.number().int().refine((id) => allowedProviderIds.has(id), { message: 'Unsupported provider ID' }))
    .max(20)
    .transform((ids) => [...new Set(ids)])
    .optional(),
  // Temporary language codes. [] = explicitly "any language".
  originalLanguages: z
    .array(z.string().trim().toLowerCase().refine((code) => allowedLanguageCodes.has(code), { message: 'Unsupported language code' }))
    .max(10)
    .transform((codes) => [...new Set(codes)])
    .optional(),
  excludedMovieIds: z.array(z.number().int().positive()).max(100).optional(),
});

export type RecommendationInput = z.infer<typeof recommendationSchema>;
