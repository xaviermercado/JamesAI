import type { Pool } from 'mysql2';

import type { ViewingFormatPreference } from './profile-schemas';
import { streamingServiceCatalog } from './reference-data';

type PromisePool = ReturnType<Pool['promise']>;

export interface StoredProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  country_code: string;
  viewing_format_preference: ViewingFormatPreference | null;
  avatar_url: string | null;
  letterboxd_username: string | null;
  letterboxd_profile_url: string | null;
  tvtime_username: string | null;
  tvtime_profile_url: string | null;
}

export interface UpsertProfileInput {
  firstName: string;
  lastName: string;
  displayName: string;
  countryCode: string;
  viewingFormatPreference?: ViewingFormatPreference | null;
  avatarUrl: string | null;
  letterboxdUsername: string | null;
  letterboxdProfileUrl: string | null;
  tvtimeUsername: string | null;
  tvtimeProfileUrl: string | null;
}

export interface StoredStreamingService {
  user_streaming_service_id: string;
  user_id: string;
  tmdb_provider_id: number;
  provider_name: string;
  logo_path: string | null;
  country_code: string;
}

export interface StreamingServiceSelection {
  providerId: number;
  providerName: string;
}

export interface StoredContentLanguage {
  user_content_language_id: string;
  user_id: string;
  language_code: string;
  sort_order: number;
}

export interface ContentLanguageSelection {
  languageCode: string;
  sortOrder: number;
}

export interface ReplacePreferencesInput {
  marketCode: string;
  viewingFormatPreference: ViewingFormatPreference | null;
  services: StreamingServiceSelection[];
  languageCodes: string[];
}

export interface ProfileRepositoryLike {
  findByUserId(userId: string): Promise<StoredProfile | null>;
  upsert(userId: string, input: UpsertProfileInput): Promise<StoredProfile>;
  listStreamingServices(userId: string): Promise<StreamingServiceSelection[]>;
  replaceStreamingServices(userId: string, countryCode: string, services: StreamingServiceSelection[]): Promise<StreamingServiceSelection[]>;
  listContentLanguages(userId: string): Promise<ContentLanguageSelection[]>;
  replaceContentLanguages(userId: string, languageCodes: string[]): Promise<ContentLanguageSelection[]>;
  replacePreferences(userId: string, input: ReplacePreferencesInput): Promise<void>;
}

export class ProfileRepository implements ProfileRepositoryLike {
  constructor(private readonly pool: PromisePool) {}

  async findByUserId(userId: string): Promise<StoredProfile | null> {
    const [rows] = await this.pool.query(
      'SELECT user_id, first_name, last_name, display_name, country_code, viewing_format_preference, avatar_url, letterboxd_username, letterboxd_profile_url, tvtime_username, tvtime_profile_url FROM profiles WHERE user_id = ? LIMIT 1',
      [userId],
    );

    return ((rows as StoredProfile[])[0] ?? null) as StoredProfile | null;
  }

  async upsert(userId: string, input: UpsertProfileInput): Promise<StoredProfile> {
    await this.pool.query(
      `INSERT INTO profiles
        (user_id, first_name, last_name, display_name, country_code, viewing_format_preference,
         avatar_url, letterboxd_username, letterboxd_profile_url, tvtime_username, tvtime_profile_url,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         first_name = VALUES(first_name),
         last_name = VALUES(last_name),
         display_name = VALUES(display_name),
         country_code = VALUES(country_code),
         viewing_format_preference = VALUES(viewing_format_preference),
         avatar_url = VALUES(avatar_url),
         letterboxd_username = VALUES(letterboxd_username),
         letterboxd_profile_url = VALUES(letterboxd_profile_url),
         tvtime_username = VALUES(tvtime_username),
         tvtime_profile_url = VALUES(tvtime_profile_url),
         updated_at = NOW(3)`,
      [
        userId,
        input.firstName,
        input.lastName,
        input.displayName,
        input.countryCode,
        input.viewingFormatPreference ?? null,
        input.avatarUrl,
        input.letterboxdUsername,
        input.letterboxdProfileUrl,
        input.tvtimeUsername,
        input.tvtimeProfileUrl,
      ],
    );

    const profile = await this.findByUserId(userId);
    if (!profile) {
      throw new Error('Profile could not be saved');
    }

    return profile;
  }

  async listStreamingServices(userId: string): Promise<StreamingServiceSelection[]> {
    const [rows] = await this.pool.query(
      'SELECT tmdb_provider_id, provider_name FROM user_streaming_services WHERE user_id = ? ORDER BY provider_name ASC',
      [userId],
    );

    return (rows as Pick<StoredStreamingService, 'tmdb_provider_id' | 'provider_name'>[]).map((row) => ({
      providerId: row.tmdb_provider_id,
      providerName: row.provider_name,
    }));
  }

  async replaceStreamingServices(userId: string, countryCode: string, services: StreamingServiceSelection[]): Promise<StreamingServiceSelection[]> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM user_streaming_services WHERE user_id = ?', [userId]);

      for (const service of services) {
        await connection.query(
          'INSERT INTO user_streaming_services (user_streaming_service_id, user_id, tmdb_provider_id, provider_name, logo_path, country_code, created_at) VALUES (UUID(), ?, ?, ?, NULL, ?, NOW(3))',
          [userId, service.providerId, service.providerName, countryCode],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return this.listStreamingServices(userId);
  }

  async listContentLanguages(userId: string): Promise<ContentLanguageSelection[]> {
    const [rows] = await this.pool.query(
      'SELECT language_code, sort_order FROM user_content_languages WHERE user_id = ? ORDER BY sort_order ASC',
      [userId],
    );

    return (rows as Pick<StoredContentLanguage, 'language_code' | 'sort_order'>[]).map((row) => ({
      languageCode: row.language_code,
      sortOrder: row.sort_order,
    }));
  }

  async replaceContentLanguages(userId: string, languageCodes: string[]): Promise<ContentLanguageSelection[]> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM user_content_languages WHERE user_id = ?', [userId]);

      for (const [index, code] of languageCodes.entries()) {
        await connection.query(
          'INSERT INTO user_content_languages (user_content_language_id, user_id, language_code, sort_order, created_at) VALUES (UUID(), ?, ?, ?, NOW(3))',
          [userId, code, index],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return this.listContentLanguages(userId);
  }

  // Atomically replaces market, streaming services, content languages, and viewing format preference.
  async replacePreferences(userId: string, input: ReplacePreferencesInput): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        'UPDATE profiles SET country_code = ?, viewing_format_preference = ?, updated_at = NOW(3) WHERE user_id = ?',
        [input.marketCode, input.viewingFormatPreference, userId],
      );

      await connection.query('DELETE FROM user_streaming_services WHERE user_id = ?', [userId]);
      for (const service of input.services) {
        await connection.query(
          'INSERT INTO user_streaming_services (user_streaming_service_id, user_id, tmdb_provider_id, provider_name, logo_path, country_code, created_at) VALUES (UUID(), ?, ?, ?, NULL, ?, NOW(3))',
          [userId, service.providerId, service.providerName, input.marketCode],
        );
      }

      await connection.query('DELETE FROM user_content_languages WHERE user_id = ?', [userId]);
      for (const [index, code] of input.languageCodes.entries()) {
        await connection.query(
          'INSERT INTO user_content_languages (user_content_language_id, user_id, language_code, sort_order, created_at) VALUES (UUID(), ?, ?, ?, NOW(3))',
          [userId, code, index],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export interface ApiProfile {
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

export function toApiProfile(profile: StoredProfile): ApiProfile {
  return {
    firstName: profile.first_name,
    lastName: profile.last_name,
    displayName: profile.display_name,
    countryCode: profile.country_code,
    viewingFormatPreference: profile.viewing_format_preference ?? null,
    avatarUrl: profile.avatar_url,
    letterboxdUsername: profile.letterboxd_username,
    letterboxdProfileUrl: profile.letterboxd_profile_url,
    tvtimeUsername: profile.tvtime_username,
    tvtimeProfileUrl: profile.tvtime_profile_url,
  };
}

export function resolveServiceSelections(providerIds: number[]): StreamingServiceSelection[] {
  return providerIds
    .map((id) => streamingServiceCatalog.find((item) => item.providerId === id))
    .filter((item): item is (typeof streamingServiceCatalog)[number] => Boolean(item))
    .map((item) => ({ providerId: item.providerId, providerName: item.providerName }));
}
