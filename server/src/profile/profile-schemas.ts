import { z } from 'zod';

const optionalUrl = z.string().trim().url().max(2048).nullable();
const optionalName = z.string().trim().max(100).nullable();
const optionalDisplayName = z.string().trim().max(80).nullable();
const personalName = z
  .string()
  .trim()
  .min(1, 'This field is required')
  .max(80, 'Must be 80 characters or fewer')
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}' -]*[\p{L}\p{M}]$|^[\p{L}\p{M}]$/u, 'Use letters, spaces, apostrophes, or hyphens only');

export const streamingServiceCatalog = [
  { providerId: 8, providerName: 'Netflix' },
  { providerId: 9, providerName: 'Prime Video' },
  { providerId: 2, providerName: 'Apple TV+' },
  { providerId: 337, providerName: 'Disney+' },
  { providerId: 1899, providerName: 'Max' },
  { providerId: 531, providerName: 'Paramount+' },
  { providerId: 15, providerName: 'Hulu' },
  { providerId: 386, providerName: 'Peacock' },
] as const;

const allowedProviderIds = streamingServiceCatalog.map((service) => service.providerId) as [number, ...number[]];

export const updateProfileSchema = z.object({
  firstName: personalName,
  lastName: personalName,
  displayName: optionalDisplayName.optional(),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Country code must be a 2-letter ISO code'),
  avatarUrl: optionalUrl.optional(),
  letterboxdUsername: optionalName.optional(),
  letterboxdProfileUrl: optionalUrl.optional(),
  tvtimeUsername: optionalName.optional(),
  tvtimeProfileUrl: optionalUrl.optional(),
});

export const updateStreamingServicesSchema = z.object({
  providerIds: z.array(z.number().int().refine((value) => allowedProviderIds.includes(value))).max(streamingServiceCatalog.length),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
