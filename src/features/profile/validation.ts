import { z } from 'zod';

const nameSchema = z
  .string()
  .trim()
  .min(1, 'This field is required')
  .max(80, 'Must be 80 characters or fewer')
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}' -]*[\p{L}\p{M}]$|^[\p{L}\p{M}]$/u, 'Use letters, spaces, apostrophes, or hyphens only');

export const editProfileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  displayName: z.string().trim().max(80, 'Must be 80 characters or fewer').optional(),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Use a 2-letter country code'),
  avatarUrl: z.string().trim().url('Enter a valid URL').max(2048).optional().or(z.literal('')),
  letterboxdUsername: z.string().trim().max(100).optional(),
  letterboxdProfileUrl: z.string().trim().url('Enter a valid URL').max(2048).optional().or(z.literal('')),
  tvtimeUsername: z.string().trim().max(100).optional(),
  tvtimeProfileUrl: z.string().trim().url('Enter a valid URL').max(2048).optional().or(z.literal('')),
});

export type EditProfileValues = z.infer<typeof editProfileSchema>;