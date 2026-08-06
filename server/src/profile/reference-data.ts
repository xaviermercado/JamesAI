import countries from 'i18n-iso-countries';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const enLocale = require('i18n-iso-countries/langs/en.json');

countries.registerLocale(enLocale);

export interface CountryCatalogItem {
  code: string; // ISO 3166-1 alpha-2
  name: string;
}

export interface LanguageCatalogItem {
  code: string; // ISO 639-1 (matches TMDB original_language field)
  name: string;
}

export interface ProviderCatalogItem {
  providerId: number; // TMDB watch-provider ID
  providerName: string;
  logoPath: string | null;
  popularRank: number;
}

export interface CountryProviderCatalog {
  marketCode: string;
  availabilityKnown: boolean;
  providers: ProviderCatalogItem[];
}

const countryNames = countries.getNames('en', { select: 'official' });

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export const countryCatalog: CountryCatalogItem[] = Object.entries(countryNames)
  .filter(([code, name]) => code.length === 2 && isNonEmptyString(name))
  .map(([code, name]) => ({ code, name: name.trim() }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const languageCatalog: readonly LanguageCatalogItem[] = [
  { code: 'ar', name: 'Arabic (al-arabiyah)' },
  { code: 'bn', name: 'Bengali (Bangla)' },
  { code: 'cs', name: 'Czech (Cestina)' },
  { code: 'da', name: 'Danish (Dansk)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'el', name: 'Greek (Ellinika)' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish (Espanol)' },
  { code: 'fa', name: 'Persian (Farsi)' },
  { code: 'fi', name: 'Finnish (Suomi)' },
  { code: 'fr', name: 'French (Francais)' },
  { code: 'he', name: 'Hebrew (Ivrit)' },
  { code: 'hi', name: 'Hindi (Hindi)' },
  { code: 'hu', name: 'Hungarian (Magyar)' },
  { code: 'id', name: 'Indonesian (Bahasa Indonesia)' },
  { code: 'it', name: 'Italian (Italiano)' },
  { code: 'ja', name: 'Japanese (Nihongo)' },
  { code: 'ko', name: 'Korean (Hangugeo)' },
  { code: 'nb', name: 'Norwegian (Norsk)' },
  { code: 'nl', name: 'Dutch (Nederlands)' },
  { code: 'pl', name: 'Polish (Polski)' },
  { code: 'pt', name: 'Portuguese (Portugues)' },
  { code: 'ro', name: 'Romanian (Romana)' },
  { code: 'ru', name: 'Russian (Russkiy)' },
  { code: 'sv', name: 'Swedish (Svenska)' },
  { code: 'th', name: 'Thai (Thai)' },
  { code: 'tr', name: 'Turkish (Turkce)' },
  { code: 'uk', name: 'Ukrainian (Ukrayinska)' },
  { code: 'vi', name: 'Vietnamese (Tieng Viet)' },
  { code: 'zh', name: 'Mandarin Chinese (Putonghua)' },
] as const;

// Stable curated providers represented by TMDB watch-provider IDs.
// providerName/logoPath are display metadata; providerId is the canonical identity.
export const streamingServiceCatalog: readonly ProviderCatalogItem[] = [
  { providerId: 8, providerName: 'Netflix', logoPath: null, popularRank: 1 },
  { providerId: 9, providerName: 'Prime Video', logoPath: null, popularRank: 2 },
  { providerId: 337, providerName: 'Disney+', logoPath: null, popularRank: 3 },
  { providerId: 2, providerName: 'Apple TV+', logoPath: null, popularRank: 4 },
  { providerId: 1899, providerName: 'Max', logoPath: null, popularRank: 5 },
  { providerId: 531, providerName: 'Paramount+', logoPath: null, popularRank: 6 },
  { providerId: 15, providerName: 'Hulu', logoPath: null, popularRank: 7 },
  { providerId: 386, providerName: 'Peacock', logoPath: null, popularRank: 8 },
  { providerId: 230, providerName: 'Crave', logoPath: null, popularRank: 9 },
  { providerId: 73, providerName: 'Tubi', logoPath: null, popularRank: 10 },
  { providerId: 1773, providerName: 'MUBI', logoPath: null, popularRank: 11 },
  { providerId: 167, providerName: 'Shudder', logoPath: null, popularRank: 12 },
  { providerId: 39, providerName: 'Stan', logoPath: null, popularRank: 13 },
] as const;

// Curated market-specific availability where Scouty can reliably enforce compatibility.
// If a market is absent, availability is treated as unknown and provider filtering remains permissive.
const providerAvailabilityByMarket: Record<string, readonly number[]> = {
  US: [8, 9, 337, 2, 1899, 531, 15, 386, 73, 1773, 167],
  CA: [8, 9, 337, 2, 1899, 531, 230, 73, 1773],
  GB: [8, 9, 337, 2, 1899, 531, 73, 1773],
  AU: [8, 9, 337, 2, 531, 39, 73, 1773],
};

export const allowedCountryCodes = new Set(countryCatalog.map((c) => c.code));
export const allowedLanguageCodes = new Set(languageCatalog.map((l) => l.code));
export const allowedProviderIds = new Set(streamingServiceCatalog.map((p) => p.providerId));

function sortProviders(items: ProviderCatalogItem[]): ProviderCatalogItem[] {
  return [...items].sort((a, b) => {
    if (a.popularRank !== b.popularRank) {
      return a.popularRank - b.popularRank;
    }
    return a.providerName.localeCompare(b.providerName);
  });
}

export function getAvailableProviderIdsForCountry(countryCode: string): Set<number> | null {
  const normalized = countryCode.trim().toUpperCase();
  const known = providerAvailabilityByMarket[normalized];
  if (!known) {
    return null;
  }
  return new Set(known);
}

export function getCountryAwareProviderCatalog(countryCode: string): CountryProviderCatalog {
  const normalized = countryCode.trim().toUpperCase();
  const availableIds = getAvailableProviderIdsForCountry(normalized);

  if (!availableIds) {
    return {
      marketCode: normalized,
      availabilityKnown: false,
      providers: sortProviders(streamingServiceCatalog as ProviderCatalogItem[]),
    };
  }

  return {
    marketCode: normalized,
    availabilityKnown: true,
    providers: sortProviders(
      (streamingServiceCatalog as ProviderCatalogItem[]).filter((provider) => availableIds.has(provider.providerId)),
    ),
  };
}

export function findIncompatibleProvidersForCountry(countryCode: string, providerIds: number[]): number[] {
  const availableIds = getAvailableProviderIdsForCountry(countryCode);
  if (!availableIds) {
    return [];
  }

  return [...new Set(providerIds)].filter((providerId) => !availableIds.has(providerId));
}
