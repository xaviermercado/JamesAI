export type ViewingFormatPreference = 'no_preference' | 'subtitles_ok' | 'prefer_dubbed';
export type ScoutyAvatarId =
  | 'binoculars'
  | 'smiling'
  | 'movie-popcorn'
  | 'smartphone'
  | 'film-reel'
  | 'thumbs-up'
  | 'empty-popcorn'
  | 'filmstrip-tangle'
  | 'heart'
  | 'checkmark'
  | 'profile-card'
  | 'sleepy';

export interface UserProfile {
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  countryCode: string;
  viewingFormatPreference: ViewingFormatPreference | null;
  personalizationEnabled: boolean;
  avatarId: ScoutyAvatarId;
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
  avatarId?: ScoutyAvatarId | null;
  letterboxdUsername?: string | null;
  letterboxdProfileUrl?: string | null;
  tvtimeUsername?: string | null;
  tvtimeProfileUrl?: string | null;
}

export interface AvatarCatalogItem {
  id: ScoutyAvatarId;
  label: string;
  assetFilename: string;
}

export interface StreamingServiceCatalogItem {
  providerId: number;
  providerName: string;
  logoPath?: string | null;
  popularRank?: number;
}

export interface UserStreamingService {
  providerId: number;
  providerName: string;
  sortOrder: number;
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
  personalizationEnabled: boolean;
  streamingServices: UserStreamingService[];
  contentLanguages: ContentLanguageSelection[];
  providerCatalogAvailabilityKnown?: boolean;
}

export interface PreferencesCatalog {
  providers: StreamingServiceCatalogItem[];
  countries: CountryCatalogItem[];
  languages: LanguageCatalogItem[];
  avatars?: AvatarCatalogItem[];
}

export interface UpdatePreferencesInput {
  marketCode: string;
  providerIds: number[];
  languageCodes: string[];
  viewingFormatPreference: ViewingFormatPreference | null;
  personalizationEnabled?: boolean;
  allowProviderPrune?: boolean;
}
