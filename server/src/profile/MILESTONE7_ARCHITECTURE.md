# Milestone 7 Architecture Notes

This document records the repository architecture reviewed before implementing Milestone 7 and the compatibility constraints that guided changes.

## Existing stack and conventions

- Frontend: Expo Router + React Native Web under src/app.
- Backend: Express + TypeScript under server/src.
- Persistence: MySQL with SQL migrations in server/src/db/migrations.
- Validation: zod schemas in route-layer modules.
- Auth/session: server-side session restoration from HttpOnly cookie + CSRF for state-changing routes.
- Testing: Vitest + Supertest with in-memory repository doubles.

## Authentication/session architecture

- Identity is always derived server-side from AUTH_SESSION_COOKIE_NAME via AuthService.restoreSession.
- Profile writes require CSRF token validation and origin checks.
- No browser-supplied user ID is accepted for profile mutation.
- SameSite behavior remains controlled in auth-cookie with default Lax fallback.

## Profile/preferences model before Milestone 7

- Country stored as canonical ISO alpha-2 code in profiles.country_code.
- Streaming preferences stored in user_streaming_services with TMDB provider IDs.
- Language preferences stored in user_content_languages with explicit sort order.
- Provider selections were previously treated as an unordered set at read/write time.

## Recommendation pipeline integration

- Saved preferences are loaded in recommendations route for authenticated users.
- resolvePreferences merges temporary overrides with saved profile data.
- Existing precedence retained: temporary overrides > saved preferences > defaults.
- Feedback personalization and watched-history suppression are applied as bounded post-filters.

## Provider identity and availability assumptions before Milestone 7

- Provider canonical identity: TMDB provider ID.
- Display names are metadata only.
- Existing reference data used a curated static provider list and did not model country availability.

## UI and accessibility patterns before Milestone 7

- Preferences screen used searchable lists and explicit buttons.
- Accessible move-up/move-down existed for language ordering.
- No existing drag-and-drop/sortable dependency was present in workspace.

## Scouty asset provenance

- Approved Scouty assets live under scouty-copilot-handoff/assets.
- scouty-hero-mascot.png is explicitly described as standalone Scouty illustration intended for product UI.

## Account deletion/reset behavior

- No explicit runtime account-deletion endpoint currently exists in server auth/profile routes.
- User-scoped data cleanup relies on FK cascade semantics where applicable.

## Milestone 7 compatibility goals

- Keep canonical country code storage unchanged.
- Preserve TMDB provider-ID identity.
- Add deterministic provider ordering with minimal schema extension.
- Add country-aware provider compatibility only where availability is known.
- Keep recommendation precedence and security boundaries intact.
