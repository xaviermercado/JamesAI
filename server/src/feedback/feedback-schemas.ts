import { z } from 'zod';

export const feedbackTypeValues = ['liked', 'disliked', 'watched'] as const;
export type FeedbackTypeValue = (typeof feedbackTypeValues)[number];

export const submitFeedbackSchema = z.object({
  tmdbId: z.number().int().positive().max(10_000_000),
  mediaType: z.enum(['movie', 'tv']),
  feedbackType: z.enum(feedbackTypeValues),
  // Optional cached metadata — provided by the client from the displayed recommendation.
  genres: z.array(z.string().trim().max(80)).max(10).optional(),
  originalLanguage: z.string().trim().toLowerCase().max(10).optional(),
}).strict();

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
