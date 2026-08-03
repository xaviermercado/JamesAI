declare module 'mysql2/promise' {
  import type { PoolOptions } from 'mysql2';
  export type { PoolOptions };

  export interface PoolConnection {
    query(sql: string, values?: readonly unknown[]): Promise<[unknown, unknown]>;
    beginTransaction(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    release(): void;
  }

  export interface Pool {
    query(sql: string, values?: readonly unknown[]): Promise<[unknown, unknown]>;
    getConnection(): Promise<PoolConnection>;
    end(): Promise<void>;
  }

  export function createPool(config: PoolOptions): Pool;
}
