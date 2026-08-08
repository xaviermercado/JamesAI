import { z } from 'zod';

export const mediaTypeSchema = z.enum(['movie', 'tv']);

export const tmdbIdSchema = z.number().int().positive().max(10_000_000);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['updated_desc', 'added_desc']).default('updated_desc'),
});

export const libraryActionSchema = z.object({
  tmdbId: tmdbIdSchema,
  mediaType: mediaTypeSchema,
  action: z.enum(['add_watchlist', 'mark_watched', 'mark_unwatched', 'remove']),
  recommendationRequestId: z.string().uuid().optional(),
}).strict();

export const libraryStateLookupSchema = z.object({
  titles: z.array(
    z.object({
      tmdbId: tmdbIdSchema,
      mediaType: mediaTypeSchema,
    }).strict(),
  ).max(100),
}).strict();

export type LibraryActionInput = z.infer<typeof libraryActionSchema>;
export type LibraryStateLookupInput = z.infer<typeof libraryStateLookupSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
