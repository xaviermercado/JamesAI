import { z } from 'zod';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(enLocale);

const allowedCountryCodes = new Set(
  Object.keys(countries.getNames('en', { select: 'official' }))
    .filter((code) => code.length === 2),
);

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
  countryCode: z.string().trim().toUpperCase().refine((code) => allowedCountryCodes.has(code), 'Use a supported 2-letter country code'),
  letterboxdUsername: z.string().trim().max(100).optional(),
  letterboxdProfileUrl: z.string().trim().url('Enter a valid URL').max(2048).optional().or(z.literal('')),
  tvtimeUsername: z.string().trim().max(100).optional(),
  tvtimeProfileUrl: z.string().trim().url('Enter a valid URL').max(2048).optional().or(z.literal('')),
});

export type EditProfileValues = z.infer<typeof editProfileSchema>;