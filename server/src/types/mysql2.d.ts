declare module 'mysql2' {
  export interface PoolOptions {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    connectionLimit?: number;
    ssl?: unknown;
    multipleStatements?: boolean;
  }

  export interface PoolConnection {
    query(sql: string, values?: readonly unknown[]): Promise<[unknown, unknown]>;
    beginTransaction(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    release(): void;
  }

  export interface PromisePoolConnection extends PoolConnection {}

  export interface PromisePool {
    query(sql: string, values?: readonly unknown[]): Promise<[unknown, unknown]>;
    getConnection(): Promise<PromisePoolConnection>;
    end(): Promise<void>;
  }

  export interface Pool {
    promise(): PromisePool;
  }

  export function createPool(config: PoolOptions): Pool;
}