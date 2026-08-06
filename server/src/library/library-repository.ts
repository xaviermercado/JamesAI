import type { Pool } from 'mysql2';

type PromisePool = ReturnType<Pool['promise']>;

export type LibraryStatus = 'watchlist' | 'watched';

export interface StoredLibraryTitle {
  user_library_title_id: string;
  user_id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  library_status: LibraryStatus;
  added_at: Date;
  watched_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ListLibraryInput {
  status: LibraryStatus;
  page: number;
  pageSize: number;
  sort: 'updated_desc' | 'added_desc';
}

export interface LibraryRepositoryLike {
  upsertWatchlist(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle>;
  markWatched(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle>;
  markUnwatched(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle>;
  removeTitle(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<boolean>;
  getTitle(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle | null>;
  listLibrary(userId: string, input: ListLibraryInput): Promise<{ rows: StoredLibraryTitle[]; total: number }>;
  listStates(userId: string, titles: Array<{ tmdbId: number; mediaType: 'movie' | 'tv' }>): Promise<StoredLibraryTitle[]>;
  listWatchedTitleIds(userId: string, mediaType: 'movie' | 'tv', limit?: number): Promise<number[]>;
  clearWatchlist(userId: string): Promise<number>;
  clearWatched(userId: string): Promise<number>;
}

export class LibraryRepository implements LibraryRepositoryLike {
  constructor(private readonly pool: PromisePool) {}

  async upsertWatchlist(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle> {
    await this.pool.query(
      `INSERT INTO user_library_titles
        (user_library_title_id, user_id, tmdb_id, media_type, library_status, added_at, watched_at, created_at, updated_at)
       VALUES (UUID(), ?, ?, ?, 'watchlist', NOW(3), NULL, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         library_status = 'watchlist',
         watched_at = NULL,
         updated_at = NOW(3)`,
      [userId, tmdbId, mediaType],
    );

    const row = await this.getTitle(userId, tmdbId, mediaType);
    if (!row) throw new Error('Library title could not be saved');
    return row;
  }

  async markWatched(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle> {
    await this.pool.query(
      `INSERT INTO user_library_titles
        (user_library_title_id, user_id, tmdb_id, media_type, library_status, added_at, watched_at, created_at, updated_at)
       VALUES (UUID(), ?, ?, ?, 'watched', NOW(3), NOW(3), NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         library_status = 'watched',
         watched_at = COALESCE(watched_at, NOW(3)),
         updated_at = NOW(3)`,
      [userId, tmdbId, mediaType],
    );

    const row = await this.getTitle(userId, tmdbId, mediaType);
    if (!row) throw new Error('Library title could not be updated');
    return row;
  }

  async markUnwatched(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle> {
    await this.pool.query(
      `INSERT INTO user_library_titles
        (user_library_title_id, user_id, tmdb_id, media_type, library_status, added_at, watched_at, created_at, updated_at)
       VALUES (UUID(), ?, ?, ?, 'watchlist', NOW(3), NULL, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         library_status = 'watchlist',
         watched_at = NULL,
         updated_at = NOW(3)`,
      [userId, tmdbId, mediaType],
    );

    const row = await this.getTitle(userId, tmdbId, mediaType);
    if (!row) throw new Error('Library title could not be updated');
    return row;
  }

  async removeTitle(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<boolean> {
    const [result] = await this.pool.query(
      'DELETE FROM user_library_titles WHERE user_id = ? AND tmdb_id = ? AND media_type = ?',
      [userId, tmdbId, mediaType],
    );
    return ((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
  }

  async getTitle(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle | null> {
    const [rows] = await this.pool.query(
      `SELECT user_library_title_id, user_id, tmdb_id, media_type, library_status, added_at, watched_at, created_at, updated_at
       FROM user_library_titles
       WHERE user_id = ? AND tmdb_id = ? AND media_type = ?
       LIMIT 1`,
      [userId, tmdbId, mediaType],
    );

    return ((rows as StoredLibraryTitle[])[0] ?? null) as StoredLibraryTitle | null;
  }

  async listLibrary(userId: string, input: ListLibraryInput): Promise<{ rows: StoredLibraryTitle[]; total: number }> {
    const offset = (input.page - 1) * input.pageSize;
    const orderBy = input.sort === 'added_desc' ? 'added_at DESC' : 'updated_at DESC';

    const [rows] = await this.pool.query(
      `SELECT user_library_title_id, user_id, tmdb_id, media_type, library_status, added_at, watched_at, created_at, updated_at
       FROM user_library_titles
       WHERE user_id = ? AND library_status = ?
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [userId, input.status, input.pageSize, offset],
    );

    const [countRows] = await this.pool.query(
      `SELECT COUNT(*) AS total
       FROM user_library_titles
       WHERE user_id = ? AND library_status = ?`,
      [userId, input.status],
    );

    const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

    return {
      rows: rows as StoredLibraryTitle[],
      total,
    };
  }

  async listStates(userId: string, titles: Array<{ tmdbId: number; mediaType: 'movie' | 'tv' }>): Promise<StoredLibraryTitle[]> {
    if (titles.length === 0) return [];

    const byMedia = {
      movie: [] as number[],
      tv: [] as number[],
    };

    for (const title of titles) {
      byMedia[title.mediaType].push(title.tmdbId);
    }

    const rows: StoredLibraryTitle[] = [];

    if (byMedia.movie.length > 0) {
      const placeholders = byMedia.movie.map(() => '?').join(', ');
      const [movieRows] = await this.pool.query(
        `SELECT user_library_title_id, user_id, tmdb_id, media_type, library_status, added_at, watched_at, created_at, updated_at
         FROM user_library_titles
         WHERE user_id = ? AND media_type = 'movie' AND tmdb_id IN (${placeholders})`,
        [userId, ...byMedia.movie],
      );
      rows.push(...(movieRows as StoredLibraryTitle[]));
    }

    if (byMedia.tv.length > 0) {
      const placeholders = byMedia.tv.map(() => '?').join(', ');
      const [tvRows] = await this.pool.query(
        `SELECT user_library_title_id, user_id, tmdb_id, media_type, library_status, added_at, watched_at, created_at, updated_at
         FROM user_library_titles
         WHERE user_id = ? AND media_type = 'tv' AND tmdb_id IN (${placeholders})`,
        [userId, ...byMedia.tv],
      );
      rows.push(...(tvRows as StoredLibraryTitle[]));
    }

    return rows;
  }

  async listWatchedTitleIds(userId: string, mediaType: 'movie' | 'tv', limit = 300): Promise<number[]> {
    const boundedLimit = Math.max(1, Math.min(limit, 1000));
    const [rows] = await this.pool.query(
      `SELECT tmdb_id
       FROM user_library_titles
       WHERE user_id = ? AND media_type = ? AND library_status = 'watched'
       ORDER BY updated_at DESC
       LIMIT ${boundedLimit}`,
      [userId, mediaType],
    );

    return (rows as Array<{ tmdb_id: number }>).map((row) => row.tmdb_id);
  }

  async clearWatchlist(userId: string): Promise<number> {
    const [result] = await this.pool.query(
      `DELETE FROM user_library_titles
       WHERE user_id = ? AND library_status = 'watchlist'`,
      [userId],
    );
    return (result as { affectedRows?: number }).affectedRows ?? 0;
  }

  async clearWatched(userId: string): Promise<number> {
    const [result] = await this.pool.query(
      `DELETE FROM user_library_titles
       WHERE user_id = ? AND library_status = 'watched'`,
      [userId],
    );
    return (result as { affectedRows?: number }).affectedRows ?? 0;
  }
}

export function toLibraryKey(tmdbId: number, mediaType: 'movie' | 'tv'): string {
  return `${mediaType}:${tmdbId}`;
}
