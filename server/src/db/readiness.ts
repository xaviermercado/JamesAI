import type { Pool } from 'mysql2';

type PromisePool = ReturnType<Pool['promise']>;

export interface DatabaseReadiness {
  status: 'ready' | 'not_configured' | 'unavailable';
}

export interface DatabaseReadinessContext {
  pool: PromisePool | null;
}

export async function checkDatabaseReadiness(context: DatabaseReadinessContext): Promise<DatabaseReadiness> {
  if (!context.pool) {
    return { status: 'not_configured' };
  }

  try {
    const connection = await context.pool.getConnection();
    try {
      await connection.query('SELECT 1');
      return { status: 'ready' };
    } finally {
      connection.release();
    }
  } catch {
    return { status: 'unavailable' };
  }
}
