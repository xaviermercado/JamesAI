import { z } from 'zod';

import { allowedLanguageCodes, allowedProviderIds } from '../../profile/reference-data';

export const CONFIGURATION_SCHEMA_VERSION = 1 as const;
export const MAX_CONTENT_PRIORITIES = 40;
export const MAX_CAMPAIGNS = 20;
export const MAX_TITLE_CONTROLS = 100;

const TMDB_GENRE_IDS = new Set([
  12, 14, 16, 18, 27, 28, 35, 36, 37, 53, 80, 99, 878, 9648, 10402, 10749, 10751, 10752, 10759,
  10762, 10763, 10764, 10765, 10766, 10767, 10768, 10770,
]);

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /\b(system|developer|assistant)\s*(message|prompt|instructions?)\s*:/i,
  /\b(jailbreak|prompt injection|do anything now)\b/i,
  /<\s*script\b/i,
  /```/,
  /\b(reveal|print|repeat)\b.{0,30}\b(system|developer)\s+prompt\b/i,
];

function sanitizeEditorialText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function editorialText(label: string, maxLength: number) {
  return z
    .string()
    .max(maxLength, `${label} is too long`)
    .superRefine((value, context) => {
      if (INJECTION_PATTERNS.some((pattern) => pattern.test(value))) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${label} contains instruction-like text` });
      }
    })
    .transform(sanitizeEditorialText)
    .refine((value) => value.length > 0, `${label} cannot be empty`);
}

const priorityPositionSchema = z.number().int().min(-2, 'Choose one of the five priority positions').max(2, 'Choose one of the five priority positions');
const canonicalProviderIdSchema = z.number().int().positive().refine((id) => allowedProviderIds.has(id), 'Choose a supported provider');
const canonicalGenreIdSchema = z.number().int().positive().refine((id) => TMDB_GENRE_IDS.has(id), 'Choose a supported genre');
const canonicalLanguageCodeSchema = z.string().trim().toLowerCase().refine((code) => allowedLanguageCodes.has(code), 'Choose a supported language');

export const titleIdSchema = z.object({
  mediaType: z.enum(['movie', 'tv']),
  tmdbId: z.number().int().positive().max(2_147_483_647),
}).strict();

const titleKey = (title: z.infer<typeof titleIdSchema>) => `${title.mediaType}:${title.tmdbId}`;

const priorityItem = <T extends z.ZodTypeAny>(identity: T) => z.object({
  id: identity,
  position: priorityPositionSchema,
}).strict();

const hardRulesSchema = z.object({
  mediaTypes: z.array(z.enum(['movie', 'tv'])).max(2).transform((values) => [...new Set(values)]),
  providerIds: z.array(canonicalProviderIdSchema).max(20).transform((values) => [...new Set(values)]),
  genreIds: z.array(canonicalGenreIdSchema).max(20).transform((values) => [...new Set(values)]),
  languageCodes: z.array(canonicalLanguageCodeSchema).max(10).transform((values) => [...new Set(values)]),
  minimumRating: z.number().min(0).max(10).nullable(),
  maximumRuntimeMinutes: z.number().int().min(1).max(600).nullable(),
  earliestReleaseYear: z.number().int().min(1874).max(2200).nullable(),
  latestReleaseYear: z.number().int().min(1874).max(2200).nullable(),
}).strict().superRefine((rules, context) => {
  if (rules.earliestReleaseYear !== null && rules.latestReleaseYear !== null && rules.earliestReleaseYear > rules.latestReleaseYear) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['latestReleaseYear'], message: 'Latest release year must be after the earliest release year' });
  }
});

const softRulesSchema = z.object({
  minimumRating: z.number().min(0).max(10).nullable(),
  targetRuntimeMinutes: z.number().int().min(1).max(600).nullable(),
  targetReleaseYear: z.number().int().min(1874).max(2200).nullable(),
}).strict();

const titleControlsSchema = z.object({
  include: z.array(titleIdSchema).max(MAX_TITLE_CONTROLS),
  exclude: z.array(titleIdSchema).max(MAX_TITLE_CONTROLS),
}).strict().superRefine((controls, context) => {
  const included = new Set(controls.include.map(titleKey));
  const excluded = new Set(controls.exclude.map(titleKey));
  if (included.size !== controls.include.length || excluded.size !== controls.exclude.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'A title can appear only once in each list' });
  }
  if ([...included].some((key) => excluded.has(key))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'A title cannot be both included and excluded' });
  }
});

const campaignSchema = z.object({
  campaignId: z.string().trim().regex(/^[a-z][a-z0-9-]{2,39}$/, 'Use a short lowercase campaign ID'),
  name: z.string().trim().min(1, 'Campaign name is required').max(80, 'Campaign name is too long'),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  priorityBoost: priorityPositionSchema,
  providerIds: z.array(canonicalProviderIdSchema).max(10).transform((values) => [...new Set(values)]),
  genreIds: z.array(canonicalGenreIdSchema).max(10).transform((values) => [...new Set(values)]),
  languageCodes: z.array(canonicalLanguageCodeSchema).max(10).transform((values) => [...new Set(values)]),
  titleIds: z.array(titleIdSchema).max(25),
  editorialNote: editorialText('Campaign editorial note', 300).nullable(),
}).strict().superRefine((campaign, context) => {
  if (Date.parse(campaign.startsAt) >= Date.parse(campaign.endsAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAt'], message: 'Campaign end must be after its start' });
  }
  if (new Set(campaign.titleIds.map(titleKey)).size !== campaign.titleIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['titleIds'], message: 'A campaign title can appear only once' });
  }
});

export const configurationSchemaV1 = z.object({
  schemaVersion: z.literal(CONFIGURATION_SCHEMA_VERSION),
  philosophy: z.object({
    statement: editorialText('Philosophy', 1_200).nullable(),
    editorialNotes: z.array(editorialText('Editorial note', 400)).max(12, 'Use no more than 12 editorial notes'),
  }).strict(),
  priorityAxes: z.object({
    popularityVsDiscovery: priorityPositionSchema,
    mainstreamVsNiche: priorityPositionSchema,
    recentVsClassic: priorityPositionSchema,
    safeVsAdventurous: priorityPositionSchema,
    conciseVsEpic: priorityPositionSchema,
    familiarVsDiverse: priorityPositionSchema,
  }).strict(),
  contentPriorities: z.object({
    providers: z.array(priorityItem(canonicalProviderIdSchema)).max(MAX_CONTENT_PRIORITIES),
    genres: z.array(priorityItem(canonicalGenreIdSchema)).max(MAX_CONTENT_PRIORITIES),
    languages: z.array(priorityItem(canonicalLanguageCodeSchema)).max(MAX_CONTENT_PRIORITIES),
  }).strict(),
  rules: z.object({ hard: hardRulesSchema, soft: softRulesSchema }).strict(),
  campaigns: z.array(campaignSchema).max(MAX_CAMPAIGNS),
  titleControls: titleControlsSchema,
}).strict().superRefine((configuration, context) => {
  for (const [field, entries] of Object.entries(configuration.contentPriorities)) {
    const identities = entries.map((entry) => String(entry.id));
    if (new Set(identities).size !== identities.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['contentPriorities', field], message: 'Each priority can appear only once' });
    }
  }
  const campaignIds = configuration.campaigns.map((campaign) => campaign.campaignId);
  if (new Set(campaignIds).size !== campaignIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['campaigns'], message: 'Campaign IDs must be unique' });
  }
});

export type JamesConfiguration = z.infer<typeof configurationSchemaV1>;

export interface ConfigurationFieldError {
  field: string;
  message: string;
}

export function validateConfiguration(input: unknown):
  | { success: true; configuration: JamesConfiguration }
  | { success: false; errors: ConfigurationFieldError[] } {
  const result = configurationSchemaV1.safeParse(input);
  if (result.success) return { success: true, configuration: result.data };
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      field: issue.path.length ? issue.path.join('.') : 'configuration',
      message: issue.message,
    })),
  };
}
