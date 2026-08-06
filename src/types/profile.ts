export type ViewingFormatPreference = 'no_preference' | 'subtitles_ok' | 'prefer_dubbed';

export interface UserProfile {
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  countryCode: string;
  viewingFormatPreference: ViewingFormatPreference | null;
  avatarUrl: string | null;
  letterboxdUsername: string | null;
  letterboxdProfileUrl: string | null;
  tvtimeUsername: string | null;
  tvtimeProfileUrl: string | null;
}

export interface UpdateUserProfileInput {
  firstName: string;
  lastName: string;
  displayName?: string | null;
  countryCode: string;
  viewingFormatPreference?: ViewingFormatPreference | null;
  avatarUrl?: string | null;
  letterboxdUsername?: string | null;
  letterboxdProfileUrl?: string | null;
  tvtimeUsername?: string | null;
  tvtimeProfileUrl?: string | null;
}

export interface StreamingServiceCatalogItem {
  providerId: number;
  providerName: string;
  logoPath?: string | null;
}

export interface UserStreamingService {
  providerId: number;
  providerName: string;
}

export interface ContentLanguageSelection {
  languageCode: string;
  sortOrder: number;
}

export interface CountryCatalogItem {
  code: string;
  name: string;
}

export interface LanguageCatalogItem {
  code: string;
  name: string;
}

export interface UserPreferences {
  marketCode: string | null;
  viewingFormatPreference: ViewingFormatPreference | null;
  streamingServices: UserStreamingService[];
  contentLanguages: ContentLanguageSelection[];
}

export interface PreferencesCatalog {
  providers: StreamingServiceCatalogItem[];
  countries: CountryCatalogItem[];
  languages: LanguageCatalogItem[];
}

export interface UpdatePreferencesInput {
  marketCode: string;
  providerIds: number[];
  languageCodes: string[];
  viewingFormatPreference: ViewingFormatPreference | null;
}
