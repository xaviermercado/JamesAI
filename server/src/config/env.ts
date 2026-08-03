import { z } from 'zod';

const mysqlSslModeSchema = z.enum(['disabled', 'preferred', 'verify-ca', 'verify-full']);

const baseEnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z.string().trim().optional().default('development'),
  TMDB_API_TOKEN: z.string().trim().optional(),
  TMDB_TIMEOUT_MS: z.coerce.number().int().min(1000).default(8000),
  OPENAI_API_KEY: z.string().trim().optional(),
  OPENAI_MODEL: z.string().trim().min(1).default('gpt-4.1-mini'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().min(1000).default(8000),
  FRONTEND_ORIGIN: z.string().trim().url().optional(),
  APP_BASE_URL: z.string().trim().url().optional(),
  AUTH_COOKIE_DOMAIN: z.string().trim().min(1).optional(),
  AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).optional(),
  EMAIL_PROVIDER: z.enum(['console', 'smtp']).optional(),
  EMAIL_HOST: z.string().trim().min(1).optional(),
  EMAIL_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  EMAIL_SECURE: z.coerce.boolean().optional(),
  EMAIL_USER: z.string().trim().min(1).optional(),
  EMAIL_API_KEY: z.string().trim().optional(),
  EMAIL_FROM: z.string().trim().min(1).optional(),
  EMAIL_TOKEN_PEPPER: z.string().trim().min(32).optional(),
  MYSQL_HOST: z.string().trim().min(1).optional(),
  MYSQL_PORT: z.coerce.number().int().min(1).max(65535).optional().default(3306),
  MYSQL_DATABASE: z.string().trim().min(1).optional(),
  MYSQL_USER: z.string().trim().min(1).optional(),
  MYSQL_PASSWORD: z.string().min(1).optional(),
  MYSQL_SSL_MODE: mysqlSslModeSchema.optional().default('preferred'),
  MYSQL_SSL_CA: z.string().optional(),
  DATABASE_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(20).optional().default(5),
  SESSION_TOKEN_PEPPER: z.string().trim().min(32).optional(),
});

type BaseEnv = z.infer<typeof baseEnvSchema>;

function normalizeUrlOrigin(value: string | undefined): string | undefined {
  return value?.trim().replace(/\/$/, '') || undefined;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  sslMode: z.infer<typeof mysqlSslModeSchema>;
  sslCa?: string;
  connectionLimit: number;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  tmdbToken?: string;
  tmdbTimeoutMs: number;
  openAiApiKey?: string;
  openAiModel: string;
  openAiTimeoutMs: number;
  frontendOrigin?: string;
  appBaseUrl?: string;
  authCookieDomain?: string;
  authCookieSameSite?: 'lax' | 'strict' | 'none';
  emailProvider: 'console' | 'smtp';
  emailHost?: string;
  emailPort?: number;
  emailSecure?: boolean;
  emailUser?: string;
  emailApiKey?: string;
  emailFrom?: string;
  emailTokenPepper?: string;
  database: DatabaseConfig | null;
  sessionTokenPepper?: string;
}

function shouldEnableDatabase(env: BaseEnv): boolean {
  return Boolean(env.MYSQL_HOST || env.MYSQL_DATABASE || env.MYSQL_USER || env.MYSQL_PASSWORD);
}

function ensureDatabaseConfig(env: BaseEnv): DatabaseConfig | null {
  if (!shouldEnableDatabase(env)) {
    return null;
  }

  const mysqlHost = env.MYSQL_HOST;
  const mysqlDatabase = env.MYSQL_DATABASE;
  const mysqlUser = env.MYSQL_USER;
  const mysqlPassword = env.MYSQL_PASSWORD;
  const sessionTokenPepper = env.SESSION_TOKEN_PEPPER;
  const emailTokenPepper = env.EMAIL_TOKEN_PEPPER;
  const emailFrom = env.EMAIL_FROM;
  const frontendOrigin = env.FRONTEND_ORIGIN;
  const appBaseUrl = env.APP_BASE_URL;
  const emailProvider = env.EMAIL_PROVIDER?.trim() || (env.NODE_ENV === 'production' ? undefined : 'console');

  if (!mysqlHost || !mysqlDatabase || !mysqlUser || !mysqlPassword || !sessionTokenPepper || !emailTokenPepper || !emailFrom || !frontendOrigin || !appBaseUrl) {
    const missing = [
      !mysqlHost ? 'MYSQL_HOST' : null,
      !mysqlDatabase ? 'MYSQL_DATABASE' : null,
      !mysqlUser ? 'MYSQL_USER' : null,
      !mysqlPassword ? 'MYSQL_PASSWORD' : null,
      !sessionTokenPepper ? 'SESSION_TOKEN_PEPPER' : null,
      !emailTokenPepper ? 'EMAIL_TOKEN_PEPPER' : null,
      !emailFrom ? 'EMAIL_FROM' : null,
      !frontendOrigin ? 'FRONTEND_ORIGIN' : null,
      !appBaseUrl ? 'APP_BASE_URL' : null,
    ].filter((value): value is string => Boolean(value));

    throw new Error(`Missing required environment variables for MySQL-enabled mode: ${missing.join(', ')}`);
  }

  if ((env.MYSQL_SSL_MODE === 'verify-ca' || env.MYSQL_SSL_MODE === 'verify-full') && !env.MYSQL_SSL_CA) {
    throw new Error('MYSQL_SSL_CA is required when MYSQL_SSL_MODE is verify-ca or verify-full');
  }

  if (env.NODE_ENV === 'production' && env.MYSQL_SSL_MODE === 'disabled') {
    throw new Error('MySQL TLS cannot be disabled in production');
  }

  if (!emailProvider) {
    throw new Error('EMAIL_PROVIDER is required in production when MySQL-enabled auth is active');
  }

  if (emailProvider === 'smtp') {
    const missingEmailSmtp = [
      !env.EMAIL_HOST ? 'EMAIL_HOST' : null,
      !env.EMAIL_PORT ? 'EMAIL_PORT' : null,
      !env.EMAIL_USER ? 'EMAIL_USER' : null,
      !env.EMAIL_API_KEY ? 'EMAIL_API_KEY' : null,
    ].filter((value): value is string => Boolean(value));

    if (missingEmailSmtp.length) {
      throw new Error(`Missing required SMTP environment variables: ${missingEmailSmtp.join(', ')}`);
    }
  }

  return {
    host: mysqlHost,
    port: env.MYSQL_PORT,
    database: mysqlDatabase,
    user: mysqlUser,
    password: mysqlPassword,
    sslMode: env.MYSQL_SSL_MODE,
    sslCa: env.MYSQL_SSL_CA,
    connectionLimit: env.DATABASE_CONNECTION_LIMIT,
  };
}

export function loadAppConfig(rawEnv: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = baseEnvSchema.parse(rawEnv);
  const database = ensureDatabaseConfig(parsed);
  const emailProvider: AppConfig['emailProvider'] = parsed.EMAIL_PROVIDER?.trim() === 'smtp' ? 'smtp' : 'console';

  return {
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
    tmdbToken: parsed.TMDB_API_TOKEN?.trim() || undefined,
    tmdbTimeoutMs: parsed.TMDB_TIMEOUT_MS,
    openAiApiKey: parsed.OPENAI_API_KEY?.trim() || undefined,
    openAiModel: parsed.OPENAI_MODEL,
    openAiTimeoutMs: parsed.OPENAI_TIMEOUT_MS,
    frontendOrigin: normalizeUrlOrigin(parsed.FRONTEND_ORIGIN),
    appBaseUrl: normalizeUrlOrigin(parsed.APP_BASE_URL),
    authCookieDomain: parsed.AUTH_COOKIE_DOMAIN?.trim() || undefined,
    authCookieSameSite: parsed.AUTH_COOKIE_SAME_SITE,
    emailProvider,
    emailHost: parsed.EMAIL_HOST?.trim() || undefined,
    emailPort: parsed.EMAIL_PORT,
    emailSecure: parsed.EMAIL_SECURE,
    emailUser: parsed.EMAIL_USER?.trim() || undefined,
    emailApiKey: parsed.EMAIL_API_KEY?.trim() || undefined,
    emailFrom: parsed.EMAIL_FROM?.trim() || undefined,
    emailTokenPepper: parsed.EMAIL_TOKEN_PEPPER?.trim() || undefined,
    database,
    sessionTokenPepper: parsed.SESSION_TOKEN_PEPPER?.trim() || undefined,
  };
}