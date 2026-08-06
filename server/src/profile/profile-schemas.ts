import { z } from 'zod';

import { allowedCountryCodes, allowedLanguageCodes, allowedProviderIds, streamingServiceCatalog } from './reference-data';
import { isSupportedScoutyAvatarId } from './avatar-catalog';

export { streamingServiceCatalog } from './reference-data';

export const MAX_SELECTED_PROVIDERS = 10;

const optionalUrl = z.string().trim().url().max(2048).nullable();
const optionalName = z.string().trim().max(100).nullable();
const optionalDisplayName = z.string().trim().max(80).nullable();
const personalName = z
  .string()
  .trim()
  .min(1, 'This field is required')
  .max(80, 'Must be 80 characters or fewer')
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}' -]*[\p{L}\p{M}]$|^[\p{L}\p{M}]$/u, 'Use letters, spaces, apostrophes, or hyphens only');

const marketCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((code) => allowedCountryCodes.has(code), { message: 'Unsupported or unrecognised country code' });

const languageCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((code) => allowedLanguageCodes.has(code), { message: 'Unsupported or unrecognised language code' });

const providerIdSchema = z
  .number()
  .int()
  .refine((id) => allowedProviderIds.has(id), { message: 'Unsupported or unrecognised provider ID' });

const avatarIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .refine((id) => isSupportedScoutyAvatarId(id), { message: 'Unsupported avatar selection' });

export const viewingFormatPreferenceValues = ['no_preference', 'subtitles_ok', 'prefer_dubbed'] as const;
export type ViewingFormatPreference = (typeof viewingFormatPreferenceValues)[number];

export const updateProfileSchema = z.object({
  firstName: personalName,
  lastName: personalName,
  displayName: optionalDisplayName.optional(),
  countryCode: marketCodeSchema,
  avatarId: avatarIdSchema.nullable().optional(),
  letterboxdUsername: optionalName.optional(),
  letterboxdProfileUrl: optionalUrl.optional(),
  tvtimeUsername: optionalName.optional(),
  tvtimeProfileUrl: optionalUrl.optional(),
  viewingFormatPreference: z.enum(viewingFormatPreferenceValues).nullable().optional(),
}).strict();

export const updateStreamingServicesSchema = z.object({
  providerIds: z
    .array(providerIdSchema)
    .max(MAX_SELECTED_PROVIDERS)
    .transform((ids) => [...new Set(ids)]),
}).strict();

export const updateContentLanguagesSchema = z.object({
  // Ordered array: index 0 = highest priority. Empty array means "any language".
  languageCodes: z
    .array(languageCodeSchema)
    .max(30)
    .transform((codes) => [...new Set(codes)]),
}).strict();

// Atomic preferences update: market + providers + languages + viewing format in one operation.
export const updatePreferencesSchema = z.object({
  marketCode: marketCodeSchema,
  providerIds: z
    .array(providerIdSchema)
    .max(MAX_SELECTED_PROVIDERS)
    .transform((ids) => [...new Set(ids)]),
  languageCodes: z
    .array(languageCodeSchema)
    .max(30)
    .transform((codes) => [...new Set(codes)]),
  viewingFormatPreference: z.enum(viewingFormatPreferenceValues).nullable(),
  personalizationEnabled: z.boolean().optional(),
  allowProviderPrune: z.boolean().optional(),
}).strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
