# Milestone 6 Baseline Architecture (Before Library Changes)

This document captures the architecture observed after Milestones 1-5 and before Milestone 6 implementation.

## Framework and routing conventions

- Frontend: Expo Router + React Native components under `src/app`.
- Protected account section: `src/app/(account)/_layout.tsx` redirects unauthenticated users to login.
- Backend: Express routers mounted in `server/src/index.ts`.
- Existing private routers use server-side session restoration + CSRF for mutations.

## Authentication and session model

- Session cookie name: `AUTH_SESSION_COOKIE_NAME`.
- Session identity resolved only through server-side `AuthService.restoreSession()`.
- Mutating routes enforce origin checks and CSRF token checks.
- Existing cookie `sameSite` resolver currently defaults to `none` in production when env override is absent (to be corrected for Milestone 6 requirement).

## Recommendation flow (Milestone 5)

- Request validated by `recommendationSchema`.
- Saved preferences loaded from profile when authenticated.
- Effective preferences resolved by `preference-resolver` with temporary override precedence.
- TMDB/OpenAI pipeline generates recommendations.
- Feedback-based personalization reranking is optional and bounded.

## Existing feedback architecture

- Feedback table: `user_title_feedback` with unique `(user_id, tmdb_id, media_type)`.
- Feedback API: `/api/feedback` create/update/remove/list/clear.
- Feedback personalization only uses explicit feedback data.
- Feedback and profile preferences are separate concepts.

## Profile and preferences architecture

- Preferences API: `/api/profile/preferences` stores market, provider IDs, language order, viewing format, personalization toggle.
- Preference updates are atomic at repository layer.

## Database migration conventions

- SQL migrations in `server/src/db/migrations` with numbered filenames.
- Existing migrations: `0001` to `0004`.
- Tables generally use UUID primary keys, foreign keys to `users(user_id)`, and `ON DELETE CASCADE` where appropriate.

## Existing watchlist/library/watched implementation

- No private-library/watchlist/watched tables, routes, repositories, or screens currently exist.
- No hidden or partial implementation found via repository scan.

## Account deletion behavior

- No explicit delete-account endpoint currently observed.
- Existing user-scoped tables rely on FK cascade cleanup from `users.user_id` where constraints exist.

## Test conventions

- Server tests use Vitest + Supertest with in-memory repository stubs.
- Existing tests cover auth/profile/recommendations/feedback and precedence behavior.

