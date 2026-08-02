import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { createRecommendationsRouter } from './routes/recommendations';
import { OpenAiService } from './services/openai-service';
import { TmdbService } from './services/tmdb-service';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const tmdbToken = process.env.TMDB_API_TOKEN;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

if (!tmdbToken) {
  console.warn('TMDB_API_TOKEN is not set. The recommendations endpoint will fail until it is configured.');
}

const openAiService = new OpenAiService({
  apiKey: process.env.OPENAI_API_KEY ?? 'missing-key',
  model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
  timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS ?? 8000),
});

const tmdbService = new TmdbService(
  {
    apiToken: tmdbToken ?? 'missing-token',
    baseUrl: 'https://api.themoviedb.org/3',
    timeoutMs: Number(process.env.TMDB_TIMEOUT_MS ?? 8000),
  },
  openAiService,
);

app.use('/api', createRecommendationsRouter(tmdbService));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
