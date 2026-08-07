# JamesAI

JamesAI is a web-first movie recommendation app built with Expo, React Native, and a Node.js/Express backend. The recommendation flow remains anonymous by default, and the new MySQL foundation is being added for optional accounts, profiles, sessions, and saved preferences.

## Architecture

- Frontend: Expo Router, React Native, and React Native Web
- Backend: Node.js, Express, and TypeScript
- Recommendation sources: TMDB and OpenAI
- Storage foundation: MySQL via the Express backend only
- Deployment: HostGator for the static web frontend and Render for the backend

## Getting started

1. Install dependencies.

   ```bash
   npm install
   ```

2. Copy the example environment file and fill in the values for your environment.

   ```bash
   copy .env.example .env
   ```

3. Start the backend.

   ```bash
   npm start
   ```

4. Start the Expo app.

   ```bash
   npm run web
   ```

## MySQL foundation

The app now includes the initial schema and migration scaffolding for:

- `users`
- `user_sessions`
- `email_verification_tokens`
- `password_reset_tokens`
- `profiles`
- `user_streaming_services`
- `user_title_feedback`

The backend uses Drizzle ORM with the `mysql2` driver. The MySQL connection is created only through the Express backend, and the initial migration is committed under `server/src/db/migrations/`.

## MySQL prerequisites

- Confirmed target: MySQL 5.7.44-48.
- Use a restricted application user for JamesAI.
- Allow Render to reach the database host and port.
- Use TLS in production and provide the CA certificate when certificate validation is required.
- Verify the database version with `SELECT VERSION();` before running migrations.
- The current Phase 1 schema avoids MySQL 8-only features so it stays compatible with this server version.

## Environment variables

Root/local frontend and backend development:

- `PORT`
- `EXPO_PUBLIC_API_BASE_URL`
- `FRONTEND_ORIGIN`
- `APP_BASE_URL`
- `AUTH_COOKIE_DOMAIN`
- `AUTH_COOKIE_SAME_SITE`
- `TMDB_API_TOKEN`
- `TMDB_TIMEOUT_MS`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_TIMEOUT_MS`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_SSL_MODE`
- `MYSQL_SSL_CA`
- `DATABASE_CONNECTION_LIMIT`
- `SESSION_TOKEN_PEPPER`
- `EMAIL_PROVIDER`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_SECURE`
- `EMAIL_USER`
- `EMAIL_FROM`
- `EMAIL_API_KEY`
- `CONTACT_EMAIL_TO`

Email can run in console mode for local development or SMTP mode in production. Console mode prints verification and reset links in the server logs. SMTP mode requires the mail host, port, username, API key or password, and sender address.

Render backend:

- Set the MySQL variables above in Render environment variables.
- Use a production `MYSQL_SSL_MODE` of `verify-ca` or `verify-full`.
- Keep `DATABASE_CONNECTION_LIMIT` small for the chosen Render plan.

Render email setup:

- Set `EMAIL_PROVIDER=smtp`.
- Set `EMAIL_HOST=smtp-relay.brevo.com`.
- Set `EMAIL_PORT=587`.
- Set `EMAIL_SECURE=false`.
- Set `EMAIL_USER=<your Brevo SMTP login, for example b4b627001@smtp-brevo.com>`.
- Set `EMAIL_FROM=Scouty <do.not.reply@scouty.ca>`.
- Set `CONTACT_EMAIL_TO` to the monitored Scouty inbox that should receive contact-form messages.
- Set `EMAIL_API_KEY` to the Brevo SMTP key/password in Render only.
- Keep `EMAIL_PROVIDER=console` for local development if you want verification and reset links printed to the server logs instead of sent by email.

HostGator frontend build:

- Set `EXPO_PUBLIC_API_BASE_URL` to the deployed Render backend URL.

## Authentication foundation

Phase 2 adds the backend auth foundation without changing the anonymous recommendation flow.

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `GET /api/auth/session`

The backend stores only opaque session token hashes in MySQL and returns the raw session token only in the secure HttpOnly cookie. The frontend never talks to MySQL directly. The app now bootstraps auth state in the background through the root layout so anonymous recommendations still render immediately.

Cookie and CSRF behavior:

- Session cookies are HttpOnly.
- Production cookies are `Secure`.
- `SameSite` is resolved from deployment context unless explicitly overridden:
- same-site frontend/API requests default to `Lax`.
- cross-site frontend/API requests default to `None` (with `Secure`) so authenticated fetch requests can carry the session cookie.
- `GET /api/auth/session` restores the session and returns a per-session CSRF token for state-changing requests.
- `POST /api/auth/logout` and `POST /api/auth/logout-all` require the CSRF token header.
- If HostGator and Render remain on different sites, `SameSite=None; Secure` is used with CSRF protection.

The current phase keeps email verification and password reset for the next step.

## Migrations

Run the initial migration from the repository root:

```bash
npm run db:migrate
```

The same command is also available from the `server/` package as `npm run db:migrate`.

## Database readiness

The backend now exposes a database-aware readiness check at `GET /health/ready`.

- `GET /health` stays as a lightweight liveness check.
- `GET /health/ready` checks MySQL connectivity when database configuration is present.

## Safe database verification

Before enabling auth features, verify all of the following manually:

1. The MySQL host accepts remote connections from Render.
2. Port 3306 or the provider-specific port is reachable.
3. TLS is enabled and the certificate or CA chain is available.
4. The JamesAI database user can access only the JamesAI database.
5. The database connection limit is compatible with the Render plan.

## Backend contract

- `POST /api/recommendations`
- `GET /api/movies/:movieId/providers`
- `GET /health`
- `GET /health/ready`

## Validation

Run the checks below before shipping changes:

```bash
npm run typecheck
npm test
```
