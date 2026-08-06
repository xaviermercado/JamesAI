import type { Pool } from 'mysql2';

import type { FeedbackEntry } from '../recommendations/taste-signals';
import { TASTE_SIGNAL_MAX_ENTRIES } from '../recommendations/taste-signals';

type PromisePool = ReturnType<Pool['promise']>;

export type StoredFeedbackType = 'liked' | 'disliked' | 'watched';

export interface StoredFeedback {
  user_title_feedback_id: string;
  user_id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  feedback_type: StoredFeedbackType;
  genres_json: string | null;
  original_language: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface FeedbackRepositoryLike {
  upsertFeedback(userId: string, tmdbId: number, mediaType: 'movie' | 'tv', feedbackType: StoredFeedbackType, meta?: { genresJson?: string | null; originalLanguage?: string | null }): Promise<StoredFeedback>;
  removeFeedback(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<boolean>;
  getFeedback(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredFeedback | null>;
  listFeedback(userId: string): Promise<StoredFeedback[]>;
  listRatedTitleKeys(userId: string, limit?: number): Promise<Array<{ tmdbId: number; mediaType: 'movie' | 'tv' }>>;
  listFeedbackForSignals(userId: string): Promise<FeedbackEntry[]>;
  clearAllFeedback(userId: string): Promise<number>;
}

export class FeedbackRepository implements FeedbackRepositoryLike {
  constructor(private readonly pool: PromisePool) {}

  async upsertFeedback(
    userId: string,
    tmdbId: number,
    mediaType: 'movie' | 'tv',
    feedbackType: StoredFeedbackType,
    meta?: { genresJson?: string | null; originalLanguage?: string | null },
  ): Promise<StoredFeedback> {
    await this.pool.query(
      `INSERT INTO user_title_feedback
        (user_title_feedback_id, user_id, tmdb_id, media_type, feedback_type, genres_json, original_language, created_at, updated_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         feedback_type = VALUES(feedback_type),
         genres_json = COALESCE(VALUES(genres_json), genres_json),
         original_language = COALESCE(VALUES(original_language), original_language),
         updated_at = NOW(3)`,
      [userId, tmdbId, mediaType, feedbackType, meta?.genresJson ?? null, meta?.originalLanguage ?? null],
    );

    const row = await this.getFeedback(userId, tmdbId, mediaType);
    if (!row) throw new Error('Feedback could not be saved');
    return row;
  }

  async removeFeedback(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<boolean> {
    const [result] = await this.pool.query(
      'DELETE FROM user_title_feedback WHERE user_id = ? AND tmdb_id = ? AND media_type = ?',
      [userId, tmdbId, mediaType],
    );
    return ((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
  }

  async getFeedback(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredFeedback | null> {
    const [rows] = await this.pool.query(
      'SELECT user_title_feedback_id, user_id, tmdb_id, media_type, feedback_type, genres_json, original_language, created_at, updated_at FROM user_title_feedback WHERE user_id = ? AND tmdb_id = ? AND media_type = ? LIMIT 1',
      [userId, tmdbId, mediaType],
    );
    return ((rows as StoredFeedback[])[0] ?? null) as StoredFeedback | null;
  }

  async listFeedback(userId: string): Promise<StoredFeedback[]> {
    const [rows] = await this.pool.query(
      'SELECT user_title_feedback_id, user_id, tmdb_id, media_type, feedback_type, genres_json, original_language, created_at, updated_at FROM user_title_feedback WHERE user_id = ? ORDER BY updated_at DESC',
      [userId],
    );
    return rows as StoredFeedback[];
  }

  async listRatedTitleKeys(
    userId: string,
    limit = 200,
  ): Promise<Array<{ tmdbId: number; mediaType: 'movie' | 'tv' }>> {
    const boundedLimit = Math.max(1, Math.min(limit, 500));
    const [rows] = await this.pool.query(
      `SELECT tmdb_id, media_type
       FROM user_title_feedback
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT ${boundedLimit}`,
      [userId],
    );

    return (rows as Array<{ tmdb_id: number; media_type: 'movie' | 'tv' }>).map((row) => ({
      tmdbId: row.tmdb_id,
      mediaType: row.media_type,
    }));
  }

  async listFeedbackForSignals(userId: string): Promise<FeedbackEntry[]> {
    const [rows] = await this.pool.query(
      `SELECT feedback_type, genres_json, original_language
       FROM user_title_feedback
       WHERE user_id = ? AND feedback_type IN ('liked', 'disliked')
       ORDER BY updated_at DESC
       LIMIT ${TASTE_SIGNAL_MAX_ENTRIES}`,
      [userId],
    );
    return (rows as Array<{ feedback_type: 'liked' | 'disliked'; genres_json: string | null; original_language: string | null }>).map((row) => ({
      feedbackType: row.feedback_type,
      genresJson: row.genres_json,
      originalLanguage: row.original_language,
    }));
  }

  async clearAllFeedback(userId: string): Promise<number> {
    const [result] = await this.pool.query('DELETE FROM user_title_feedback WHERE user_id = ?', [userId]);
    return (result as { affectedRows?: number }).affectedRows ?? 0;
  }
}
