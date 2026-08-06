// Static reference catalogs. Values are stable identifiers used in DB storage and API responses.
// Display names are for the UI only; never persist them as canonical values.

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
}

export const countryCatalog: readonly CountryCatalogItem[] = [
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AT', name: 'Austria' },
  { code: 'AU', name: 'Australia' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DE', name: 'Germany' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EG', name: 'Egypt' },
  { code: 'ES', name: 'Spain' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'GR', name: 'Greece' },
  { code: 'HK', name: 'Hong Kong SAR' },
  { code: 'HR', name: 'Croatia' },
  { code: 'HU', name: 'Hungary' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IN', name: 'India' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'MX', name: 'Mexico' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SE', name: 'Sweden' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'US', name: 'United States' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ZA', name: 'South Africa' },
] as const;

export const languageCatalog: readonly LanguageCatalogItem[] = [
  { code: 'ar', name: 'Arabic (العربية)' },
  { code: 'bn', name: 'Bengali (বাংলা)' },
  { code: 'cs', name: 'Czech (Čeština)' },
  { code: 'da', name: 'Danish (Dansk)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'el', name: 'Greek (Ελληνικά)' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'fa', name: 'Persian (فارسی)' },
  { code: 'fi', name: 'Finnish (Suomi)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'he', name: 'Hebrew (עברית)' },
  { code: 'hi', name: 'Hindi (हिन्दी)' },
  { code: 'hu', name: 'Hungarian (Magyar)' },
  { code: 'id', name: 'Indonesian (Bahasa Indonesia)' },
  { code: 'it', name: 'Italian (Italiano)' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'ko', name: 'Korean (한국어)' },
  { code: 'nb', name: 'Norwegian (Norsk)' },
  { code: 'nl', name: 'Dutch (Nederlands)' },
  { code: 'pl', name: 'Polish (Polski)' },
  { code: 'pt', name: 'Portuguese (Português)' },
  { code: 'ro', name: 'Romanian (Română)' },
  { code: 'ru', name: 'Russian (Русский)' },
  { code: 'sv', name: 'Swedish (Svenska)' },
  { code: 'th', name: 'Thai (ไทย)' },
  { code: 'tr', name: 'Turkish (Türkçe)' },
  { code: 'uk', name: 'Ukrainian (Українська)' },
  { code: 'vi', name: 'Vietnamese (Tiếng Việt)' },
  { code: 'zh', name: 'Mandarin Chinese (普通话)' },
] as const;

// TMDB watch-provider IDs. logoPath values reference TMDB's image CDN
// (https://image.tmdb.org/t/p/original{logoPath}). Availability by market is not modeled here;
// market-specific filtering belongs to a future TMDB watch-provider API integration.
export const streamingServiceCatalog: readonly ProviderCatalogItem[] = [
  { providerId: 8, providerName: 'Netflix', logoPath: null },
  { providerId: 9, providerName: 'Prime Video', logoPath: null },
  { providerId: 2, providerName: 'Apple TV+', logoPath: null },
  { providerId: 337, providerName: 'Disney+', logoPath: null },
  { providerId: 1899, providerName: 'Max', logoPath: null },
  { providerId: 531, providerName: 'Paramount+', logoPath: null },
  { providerId: 15, providerName: 'Hulu', logoPath: null },
  { providerId: 386, providerName: 'Peacock', logoPath: null },
  { providerId: 1773, providerName: 'MUBI', logoPath: null },
  { providerId: 167, providerName: 'Shudder', logoPath: null },
  { providerId: 39, providerName: 'Stan', logoPath: null },
  { providerId: 230, providerName: 'Crave', logoPath: null },
] as const;

export const allowedCountryCodes = new Set(countryCatalog.map((c) => c.code));
export const allowedLanguageCodes = new Set(languageCatalog.map((l) => l.code));
export const allowedProviderIds = new Set(streamingServiceCatalog.map((p) => p.providerId));
