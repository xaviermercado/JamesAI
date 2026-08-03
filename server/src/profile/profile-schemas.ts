import { z } from 'zod';

const optionalUrl = z.string().trim().url().max(2048).nullable();
const optionalName = z.string().trim().max(100).nullable();

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Country code must be a 2-letter ISO code'),
  avatarUrl: optionalUrl.optional(),
  letterboxdUsername: optionalName.optional(),
  letterboxdProfileUrl: optionalUrl.optional(),
  tvtimeUsername: optionalName.optional(),
  tvtimeProfileUrl: optionalUrl.optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
