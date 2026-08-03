import type { Pool } from 'mysql2';

type PromisePool = ReturnType<Pool['promise']>;

export interface StoredProfile {
  user_id: string;
  display_name: string;
  country_code: string;
  avatar_url: string | null;
  letterboxd_username: string | null;
  letterboxd_profile_url: string | null;
  tvtime_username: string | null;
  tvtime_profile_url: string | null;
}

export interface UpsertProfileInput {
  displayName: string;
  countryCode: string;
  avatarUrl: string | null;
  letterboxdUsername: string | null;
  letterboxdProfileUrl: string | null;
  tvtimeUsername: string | null;
  tvtimeProfileUrl: string | null;
}

export interface ProfileRepositoryLike {
  findByUserId(userId: string): Promise<StoredProfile | null>;
  upsert(userId: string, input: UpsertProfileInput): Promise<StoredProfile>;
}

export class ProfileRepository implements ProfileRepositoryLike {
  constructor(private readonly pool: PromisePool) {}

  async findByUserId(userId: string): Promise<StoredProfile | null> {
    const [rows] = await this.pool.query(
      'SELECT user_id, display_name, country_code, avatar_url, letterboxd_username, letterboxd_profile_url, tvtime_username, tvtime_profile_url FROM profiles WHERE user_id = ? LIMIT 1',
      [userId],
    );

    return ((rows as StoredProfile[])[0] ?? null) as StoredProfile | null;
  }

  async upsert(userId: string, input: UpsertProfileInput): Promise<StoredProfile> {
    await this.pool.query(
      'INSERT INTO profiles (user_id, display_name, country_code, avatar_url, letterboxd_username, letterboxd_profile_url, tvtime_username, tvtime_profile_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3)) ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), country_code = VALUES(country_code), avatar_url = VALUES(avatar_url), letterboxd_username = VALUES(letterboxd_username), letterboxd_profile_url = VALUES(letterboxd_profile_url), tvtime_username = VALUES(tvtime_username), tvtime_profile_url = VALUES(tvtime_profile_url), updated_at = NOW(3)',
      [
        userId,
        input.displayName,
        input.countryCode,
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
}

export interface ApiProfile {
  displayName: string;
  countryCode: string;
  avatarUrl: string | null;
  letterboxdUsername: string | null;
  letterboxdProfileUrl: string | null;
  tvtimeUsername: string | null;
  tvtimeProfileUrl: string | null;
}

export function toApiProfile(profile: StoredProfile): ApiProfile {
  return {
    displayName: profile.display_name,
    countryCode: profile.country_code,
    avatarUrl: profile.avatar_url,
    letterboxdUsername: profile.letterboxd_username,
    letterboxdProfileUrl: profile.letterboxd_profile_url,
    tvtimeUsername: profile.tvtime_username,
    tvtimeProfileUrl: profile.tvtime_profile_url,
  };
}
