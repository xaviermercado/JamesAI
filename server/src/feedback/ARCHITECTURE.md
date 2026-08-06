# Existing Feedback Architecture (Pre-Milestone-5 Update)

This document captures the feedback architecture that existed before Milestone 5 completion work.

## Current feedback states

The system currently stores three explicit feedback states in `user_title_feedback.feedback_type`:
- `liked`
- `disliked`
- `watched`

Frontend labels currently map to:
- `Like` -> `liked`
- `Not for me` -> `disliked`
- `Watched` -> `watched`

## Data model and identity

Feedback storage table: `user_title_feedback`
- `user_id` (FK to `users.user_id`)
- `tmdb_id` (INT UNSIGNED)
- `media_type` (`movie` | `tv`)
- `feedback_type` (`liked` | `disliked` | `watched`)
- `created_at`, `updated_at`
- Unique key: `(user_id, tmdb_id, media_type)`

This enforces one current feedback state per user+title+media type.
Movie and TV identifiers are separated by compound identity `(tmdb_id, media_type)`.

Migration coverage:
- `0001_initial.sql` creates `user_title_feedback`
- `0004_personalization_settings.sql` adds:
  - `profiles.personalization_enabled` (default true)
  - `user_title_feedback.genres_json` (nullable)
  - `user_title_feedback.original_language` (nullable)

## API surface

Feedback API implementation exists in `server/src/feedback/feedback-router.ts`:
- `GET /api/feedback` -> list current user's feedback
- `POST /api/feedback` -> upsert feedback row
- `DELETE /api/feedback/:tmdbId/:mediaType` -> remove a single feedback row
- `DELETE /api/feedback` -> clear all feedback for current user

Authorization model:
- Requires authenticated session cookie for all feedback operations
- Resolves user identity server-side from session
- No browser-supplied user ID is accepted
- CSRF enforced for mutating operations
- Origin checks for mutating operations

Validation model:
- Zod schema in `feedback-schemas.ts`
- Validates `tmdbId`, `mediaType`, `feedbackType`
- Optional metadata: `genres[]`, `originalLanguage`

## Repository behavior

`FeedbackRepository` supports:
- idempotent upsert (via `ON DUPLICATE KEY UPDATE`)
- remove
- lookup
- list
- clear all
- load limited signal inputs via `listFeedbackForSignals()`

Signal input rows are limited by `TASTE_SIGNAL_MAX_ENTRIES`.

## Learning signal module status

Pure module exists: `server/src/recommendations/taste-signals.ts`
- Uses only explicit feedback rows (`liked`, `disliked`)
- Excludes `watched` from learning
- Bounded scores and thresholds
- Minimum evidence rule (`TASTE_SIGNAL_MIN_EVIDENCE`)
- Deterministic and unit-testable

## Gaps observed before this milestone update

- Feedback router exists but is not mounted in `server/src/index.ts`.
- Recommendation route does not yet consume learned signals.
- Frontend feedback controls are local-only state (not persisted).
- No dedicated automated tests for feedback router/repository/taste signals.
- `profiles.personalization_enabled` exists in migration but is not fully wired through profile API/UI.
