# JamesAI

JamesAI is a web-first movie recommendation app built with Expo, React Native, and a lightweight Node.js backend.

## Getting started

1. Install dependencies

   ```bash
   npm install
   ```

2. Copy the example environment file and fill in any required values

   ```bash
   copy .env.example .env
   ```

3. Start the backend

   ```bash
   npx tsx server/src/index.ts
   ```

4. Start the Expo app

   ```bash
   npm run web
   ```

## Environment variables

The backend uses the following environment variables:

- `PORT`
- `TMDB_API_TOKEN`
- `TMDB_TIMEOUT_MS`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_TIMEOUT_MS`

## Backend contract

- `POST /api/recommendations`
- `GET /api/movies/:movieId/providers`

## Validation

Run the checks below before shipping changes:

```bash
npm run typecheck
npm test
```
