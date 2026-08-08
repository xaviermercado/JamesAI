import type { Pool } from 'mysql2';

import type { LetterboxdSeenTitleInput } from './letterboxd-rss';

type PromisePool = ReturnType<Pool['promise']>;

export interface StoredLetterboxdSettings {
  user_id: string;
  public_activity_enabled: number;
  rss_status: 'idle' | 'ok' | 'error';
  rss_last_checked_at: Date | null;
  rss_last_success_at: Date | null;
  rss_last_error_code: string | null;
  rss_last_error_message: string | null;
  rss_etag: string | null;
  rss_last_modified: string | null;
}

export interface LetterboxdSeenTitleKey {
  normalizedTitle: string;
  releaseYear: number | null;
}

export interface LetterboxdRepositoryLike {
  getSettings(userId: string): Promise<StoredLetterboxdSettings | null>;
  setPublicActivityEnabled(userId: string, enabled: boolean): Promise<StoredLetterboxdSettings>;
  markRssNotModified(userId: string, metadata: { etag?: string | null; lastModified?: string | null }): Promise<void>;
  replaceRssTitles(userId: string, titles: LetterboxdSeenTitleInput[], metadata: { etag?: string | null; lastModified?: string | null }): Promise<void>;
  markRssError(userId: string, code: string, message: string): Promise<void>;
  replaceExportTitles(userId: string, titles: LetterboxdSeenTitleInput[]): Promise<void>;
  clearExportTitles(userId: string): Promise<number>;
  listSeenTitleKeys(userId: string, limit?: number): Promise<LetterboxdSeenTitleKey[]>;
  countTitlesBySource(userId: string): Promise<{ rssCount: number; exportCount: number }>;
}

export class LetterboxdRepository implements LetterboxdRepositoryLike {
  constructor(private readonly pool: PromisePool) {}

  async getSettings(userId: string): Promise<StoredLetterboxdSettings | null> {
    const [rows] = await this.pool.query(
      `SELECT user_id, public_activity_enabled, rss_status, rss_last_checked_at, rss_last_success_at,
              rss_last_error_code, rss_last_error_message, rss_etag, rss_last_modified
       FROM user_letterboxd_settings
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );
    return ((rows as StoredLetterboxdSettings[])[0] ?? null) as StoredLetterboxdSettings | null;
  }

  async setPublicActivityEnabled(userId: string, enabled: boolean): Promise<StoredLetterboxdSettings> {
    await this.pool.query(
      `INSERT INTO user_letterboxd_settings
         (user_id, public_activity_enabled, rss_status, created_at, updated_at)
       VALUES (?, ?, 'idle', NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         public_activity_enabled = VALUES(public_activity_enabled),
         updated_at = NOW(3)`,
      [userId, enabled ? 1 : 0],
    );

    const settings = await this.getSettings(userId);
    if (!settings) {
      throw new Error('Unable to save Letterboxd settings');
    }
    return settings;
  }

  async markRssNotModified(userId: string, metadata: { etag?: string | null; lastModified?: string | null }): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_letterboxd_settings
         (user_id, public_activity_enabled, rss_status, rss_last_checked_at, rss_last_success_at,
          rss_last_error_code, rss_last_error_message, rss_etag, rss_last_modified, created_at, updated_at)
       VALUES (?, 0, 'ok', NOW(3), NOW(3), NULL, NULL, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         rss_status = 'ok',
         rss_last_checked_at = NOW(3),
         rss_last_success_at = NOW(3),
         rss_last_error_code = NULL,
         rss_last_error_message = NULL,
         rss_etag = VALUES(rss_etag),
         rss_last_modified = VALUES(rss_last_modified),
         updated_at = NOW(3)`,
      [userId, metadata.etag ?? null, metadata.lastModified ?? null],
    );
  }

  async replaceRssTitles(userId: string, titles: LetterboxdSeenTitleInput[], metadata: { etag?: string | null; lastModified?: string | null }): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `INSERT INTO user_letterboxd_settings
           (user_id, public_activity_enabled, rss_status, rss_last_checked_at, rss_last_success_at,
            rss_last_error_code, rss_last_error_message, rss_etag, rss_last_modified, created_at, updated_at)
         VALUES (?, 0, 'ok', NOW(3), NOW(3), NULL, NULL, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           rss_status = 'ok',
           rss_last_checked_at = NOW(3),
           rss_last_success_at = NOW(3),
           rss_last_error_code = NULL,
           rss_last_error_message = NULL,
           rss_etag = VALUES(rss_etag),
           rss_last_modified = VALUES(rss_last_modified),
           updated_at = NOW(3)`,
        [userId, metadata.etag ?? null, metadata.lastModified ?? null],
      );

      await connection.query(
        `DELETE FROM user_letterboxd_seen_titles
         WHERE user_id = ? AND source = 'rss'`,
        [userId],
      );

      for (const title of titles) {
        await connection.query(
          `INSERT INTO user_letterboxd_seen_titles
             (user_letterboxd_seen_title_id, user_id, source, normalized_title, release_year, watched_at,
              is_rewatch, rating_tenths, liked, raw_title, created_at)
           VALUES (UUID(), ?, 'rss', ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
          [
            userId,
            title.normalizedTitle,
            title.releaseYear,
            title.watchedAt,
            title.isRewatch ? 1 : 0,
            title.ratingTenths,
            title.liked ? 1 : 0,
            title.rawTitle,
          ],
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

  async markRssError(userId: string, code: string, message: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_letterboxd_settings
         (user_id, public_activity_enabled, rss_status, rss_last_checked_at, rss_last_error_code, rss_last_error_message, created_at, updated_at)
       VALUES (?, 0, 'error', NOW(3), ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         rss_status = 'error',
         rss_last_checked_at = NOW(3),
         rss_last_error_code = VALUES(rss_last_error_code),
         rss_last_error_message = VALUES(rss_last_error_message),
         updated_at = NOW(3)`,
      [userId, code.slice(0, 64), message.slice(0, 255)],
    );
  }

  async replaceExportTitles(userId: string, titles: LetterboxdSeenTitleInput[]): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `DELETE FROM user_letterboxd_seen_titles
         WHERE user_id = ? AND source = 'export'`,
        [userId],
      );

      for (const title of titles) {
        await connection.query(
          `INSERT INTO user_letterboxd_seen_titles
             (user_letterboxd_seen_title_id, user_id, source, normalized_title, release_year, watched_at,
              is_rewatch, rating_tenths, liked, raw_title, created_at)
           VALUES (UUID(), ?, 'export', ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
          [
            userId,
            title.normalizedTitle,
            title.releaseYear,
            title.watchedAt,
            title.isRewatch ? 1 : 0,
            title.ratingTenths,
            title.liked ? 1 : 0,
            title.rawTitle,
          ],
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

  async clearExportTitles(userId: string): Promise<number> {
    const [result] = await this.pool.query(
      `DELETE FROM user_letterboxd_seen_titles
       WHERE user_id = ? AND source = 'export'`,
      [userId],
    );
    return (result as { affectedRows?: number }).affectedRows ?? 0;
  }

  async listSeenTitleKeys(userId: string, limit = 1500): Promise<LetterboxdSeenTitleKey[]> {
    const boundedLimit = Math.max(1, Math.min(limit, 5000));
    const [rows] = await this.pool.query(
      `SELECT normalized_title, release_year
       FROM user_letterboxd_seen_titles
       WHERE user_id = ?
       ORDER BY watched_at DESC, created_at DESC
       LIMIT ${boundedLimit}`,
      [userId],
    );
    return (rows as Array<{ normalized_title: string; release_year: number | null }>).map((row) => ({
      normalizedTitle: row.normalized_title,
      releaseYear: row.release_year,
    }));
  }

  async countTitlesBySource(userId: string): Promise<{ rssCount: number; exportCount: number }> {
    const [rows] = await this.pool.query(
      `SELECT source, COUNT(*) AS count
       FROM user_letterboxd_seen_titles
       WHERE user_id = ?
       GROUP BY source`,
      [userId],
    );

    let rssCount = 0;
    let exportCount = 0;
    for (const row of rows as Array<{ source: 'rss' | 'export'; count: number }>) {
      if (row.source === 'rss') rssCount = Number(row.count);
      if (row.source === 'export') exportCount = Number(row.count);
    }
    return { rssCount, exportCount };
  }
}
