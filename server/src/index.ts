import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createHmac } from 'node:crypto';

import { loadAppConfig } from './config/env';
import { createDatabaseConnection } from './db/client';
import { checkDatabaseReadiness } from './db/readiness';
import { createAuthRouter } from './auth/auth-router';
import { AuthRepository } from './auth/auth-repository';
import { createProfileRouter } from './profile/profile-router';
import { ProfileRepository } from './profile/profile-repository';
import { createRecommendationsRouter } from './routes/recommendations';
import { OpenAiService } from './services/openai-service';
import { TmdbService } from './services/tmdb-service';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const config = loadAppConfig(process.env);

// Log the first 8 chars of a known-input hash so we can compare pepper consistency between environments.
const emailPepperFingerprint = config.emailTokenPepper
  ? createHmac('sha256', config.emailTokenPepper).update('canary').digest('hex').slice(0, 8)
  : 'not-set';
const sessionPepperFingerprint = config.sessionTokenPepper
  ? createHmac('sha256', config.sessionTokenPepper).update('canary').digest('hex').slice(0, 8)
  : 'not-set';
logger.info('server.startup', { emailPepperFingerprint, sessionPepperFingerprint, frontendOrigin: config.frontendOrigin, appBaseUrl: config.appBaseUrl });

const databaseConnection = config.database ? createDatabaseConnection(config.database) : null;
const tmdbToken = config.tmdbToken;
const authRepository = databaseConnection ? new AuthRepository(databaseConnection.pool) : null;
const profileRepository = databaseConnection ? new ProfileRepository(databaseConnection.pool) : null;

app.use(cors({
  origin: config.frontendOrigin ?? true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', 1);
app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestId = `${startedAt}-${Math.round(Math.random() * 1_000_000)}`;

  res.setHeader('x-request-id', requestId);
  res.on('finish', () => {
    const elapsedMs = Date.now() - startedAt;
    logger.info('api.request', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: elapsedMs,
      origin: req.headers.origin ?? null,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  });

  next();
});

process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandledRejection', { error: reason });
});

process.on('uncaughtException', (error) => {
  logger.error('process.uncaughtException', { error });
});

if (!tmdbToken) {
  console.warn('TMDB_API_TOKEN is not set. The recommendations endpoint will fail until it is configured.');
}

const openAiService = new OpenAiService({
  apiKey: config.openAiApiKey ?? 'missing-key',
  model: config.openAiModel,
  timeoutMs: config.openAiTimeoutMs,
});

const tmdbService = new TmdbService(
  {
    apiToken: tmdbToken ?? 'missing-token',
    baseUrl: 'https://api.themoviedb.org/3',
    timeoutMs: config.tmdbTimeoutMs,
  },
  openAiService,
);

if (authRepository) {
  app.use('/api/auth', createAuthRouter(config, authRepository));

  if (profileRepository) {
    app.use('/api/profile', createProfileRouter(config, authRepository, profileRepository));
  }
} else {
  app.get('/api/auth/session', (_req, res) => {
    res.json({ authenticated: false, user: null, csrfToken: null });
  });

  app.use('/api/auth', (_req, res) => {
    res.status(503).json({
      error: 'Authentication is disabled. Configure MySQL and auth environment variables to enable account features.',
    });
  });

  app.use('/api/profile', (_req, res) => {
    res.status(503).json({
      error: 'Profile features are disabled until authentication is enabled.',
    });
  });
}

app.use('/api', createRecommendationsRouter(tmdbService));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', emailPepperFingerprint, sessionPepperFingerprint, appBaseUrl: config.appBaseUrl });
});

app.get('/health/ready', async (_req, res) => {
  const readiness = await checkDatabaseReadiness({ pool: databaseConnection?.pool ?? null });
  if (readiness.status === 'unavailable') {
    return res.status(503).json({ status: 'error' });
  }

  return res.json({ status: 'ok' });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Server listening on port ${config.port}`);
});
