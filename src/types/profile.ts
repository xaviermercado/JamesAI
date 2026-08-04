export interface UserProfile {
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  countryCode: string;
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
  avatarUrl?: string | null;
  letterboxdUsername?: string | null;
  letterboxdProfileUrl?: string | null;
  tvtimeUsername?: string | null;
  tvtimeProfileUrl?: string | null;
}

export interface StreamingServiceCatalogItem {
  providerId: number;
  providerName: string;
}

export interface UserStreamingService {
  providerId: number;
  providerName: string;
}