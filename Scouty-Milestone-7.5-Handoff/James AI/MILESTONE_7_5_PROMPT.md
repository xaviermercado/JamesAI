# Scouty.ca Milestone 7.5 — selectable Scouty profile avatars

Implement Milestone 7.5 as a focused follow-up to the already-completed Milestone 7.

Milestone 7 has already run. Do not repeat or substantially rewrite its country selector, streaming-service catalogue, provider ordering, drag-and-drop controls, recommendation precedence, authentication, or unrelated profile work. First inspect the repository and the Milestone 7 result, preserve all working behavior, then add only the missing selectable-avatar feature described here.

Do not deploy, modify production data, use production credentials, or change production infrastructure.

## Supplied avatar artwork

This handoff includes all 12 approved Scouty PNGs. Import every image into the repository through its established local-asset conventions; do not omit any image, regenerate Scouty, replace these files with lookalikes, or use remote image URLs.

| Stable avatar ID | User-facing label | Supplied filename |
|---|---|---|
| `binoculars` | Explorer Scouty | `Scouty Searches with Binoculars.png` |
| `smiling` | Smiling Scouty | `Scouty’s smiling blue raccoon avatar.png` |
| `movie-popcorn` | Movie Night Scouty | `Scouty’s 3D Movie Popcorn.png` |
| `smartphone` | Mobile Scouty | `Scouty checks a smartphone.png` |
| `film-reel` | Film Reel Scouty | `Scouty Loads a Blue Film Reel.png` |
| `thumbs-up` | Thumbs-Up Scouty | `Scouty’s sparkling thumbs-up.png` |
| `empty-popcorn` | Empty Popcorn Scouty | `Scouty and the Empty Popcorn Bucket.png` |
| `filmstrip-tangle` | Puzzled Scouty | `Scouty’s puzzled filmstrip tangle.png` |
| `heart` | Heart Scouty | `Scouty Hugs a Coral Heart.png` |
| `checkmark` | Celebration Scouty | `Scouty celebrates with a checkmark badge.png` |
| `profile-card` | Profile Scouty | `Scouty Waves with a Profile Card.png` |
| `sleepy` | Sleepy Scouty | `Sleepy Scouty with Popcorn and Stars.png` |

The stable ID is persisted; filenames, labels, paths, and artwork metadata are presentation details. If repository filename conventions require ASCII-safe names, copy the supplied files to deterministic names such as `scouty-avatar-smiling.png`, preserve the originals in the handoff, and maintain the mapping above in one typed server-owned catalogue.

## Required product behavior

- Replace Milestone 7's universal fixed avatar with a profile avatar picker containing all 12 supplied choices.
- Show the choices as a compact responsive grid of image buttons or radio options, with each full Scouty figure visible and not unintentionally cropped.
- Provide a clear selected state using more than color alone, such as a visible checkmark plus `aria-checked` or native radio semantics.
- Show the selected avatar in the profile header and any existing authenticated account menu that already displays an avatar.
- Save explicitly with the existing profile form unless the application has one well-tested, consistent immediate-save convention.
- Do not claim the selection is saved until persistence succeeds.
- Persist the stable avatar ID across refresh, logout/login, session restoration, and supported devices.
- Use `smiling` as the default for users with no saved avatar, unless Milestone 7 already established another approved default; if so, map that existing default deterministically and document it.
- Keep a last-confirmed value and editable draft. On failure, preserve the confirmed avatar, keep the draft available, announce the error, and allow retry.
- Prevent duplicate submissions and stale responses from overwriting newer selections.
- If a stored avatar ID is missing or invalid, render the default safely without erasing or rewriting unrelated profile data.
- Avatar selection is cosmetic. It must not influence recommendations, saved country, provider order, languages, feedback, watchlist, watched history, analytics personalization, roles, or authentication.

Do not add user uploads, camera access, cropping tools, external avatar URLs, Gravatar, generated-on-demand artwork, social profiles, public profiles, friends/followers, image moderation, or Letterboxd behavior.

## Asset handling

- Store the files as bundled static assets using repository conventions.
- Optimize delivery where the existing image pipeline supports it, while preserving visual quality and transparent backgrounds.
- Do not overwrite or destructively recompress the supplied originals.
- Define width, height, or aspect ratio to prevent layout shift.
- Use `object-fit: contain` for picker thumbnails unless inspection proves another treatment preserves the complete artwork.
- Verify every file loads in development and the production build, including filenames originally containing curly apostrophes or spaces.
- Prefer normalized ASCII destination filenames to avoid URL and deployment inconsistencies.
- Do not encode email, name, user ID, session ID, or avatar selection in image URLs or public cache keys.
- Shared avatar image assets may be publicly cacheable; authenticated profile responses and selected-avatar state must remain private according to existing conventions.
- Provide a neutral local fallback when an image fails without silently changing the saved ID.

## Data model and API

Inspect the completed Milestone 7 profile schema and extend it minimally.

- Add one nullable or defaulted avatar field following repository naming conventions, storing only one whitelisted stable ID from the 12-item server-owned catalogue.
- Do not store filenames, filesystem paths, image bytes, arbitrary URLs, labels, or browser-supplied metadata in the user record.
- Add the smallest safe migration required. Preserve all existing profile rows and preferences.
- If the profile update endpoint is reused, whitelist the avatar field and ensure partial updates cannot erase unrelated fields.
- Derive ownership exclusively from the verified server-side session; never accept a browser-supplied user ID.
- Reject unknown IDs, unsupported fields, arrays, objects, oversized values, and mass assignment with a generic client-facing error.
- Keep updates idempotent and use the existing stale-write/version mechanism when available.
- Preserve the working `SameSite=Lax` session-cookie behavior and existing CSRF/origin protections.
- Include the new field in established account-deletion handling automatically through the profile record; do not create a second identity or storage system.

## Accessibility and responsive requirements

- Use native radio semantics or an accessible single-select pattern with a programmatic group label such as “Choose your Scouty avatar.”
- Every option must have an accessible name based on the user-facing label above; filenames must not become labels.
- Support Tab and standard keyboard selection. Do not require drag-and-drop, hover, or a pointer.
- Keep visible focus and a selected indicator with WCAG AA contrast.
- Make targets at least 44×44 CSS pixels and avoid nested interactive controls.
- Announce save success and failure through the existing restrained live-region pattern.
- Use appropriate image alternative text; avoid duplicate announcements when the option's accessible name already identifies the image.
- Verify the grid and selected-avatar display at 320×568, 360×800, 375×667, 390×844, 430×932, tablet portrait/landscape, 1024, 1280, and 1440 pixels, plus 200% zoom.
- Confirm long localized labels wrap, the full artwork remains understandable, and document width never exceeds viewport width.
- Respect reduced motion and do not add decorative selection animation that causes layout shifts.

## Tests

Add focused semantic tests for:

- all 12 stable IDs existing in the server-owned catalogue exactly once;
- all 12 supplied images resolving successfully;
- default avatar behavior for new and existing users;
- loading a saved avatar;
- selecting and saving each valid avatar ID;
- refresh, logout/login, and session-restoration persistence;
- unknown, malformed, oversized, array, object, and unsupported avatar values;
- unauthenticated mutation rejection;
- browser-supplied user-ID and cross-user update rejection;
- mass-assignment prevention and preservation of unrelated profile fields;
- idempotent duplicate saves, overlapping requests, and stale-response prevention;
- session expiry and save-failure recovery;
- accessible group, option names, keyboard selection, focus, selected state, and status announcements where supported;
- avatar fallback when an asset fails;
- private cache behavior for profile state and safe public caching for static artwork;
- account deletion behavior;
- Milestone 7 country names/codes, provider selection/order, and language preferences remaining unchanged;
- feedback, watchlist, watched history, anonymous recommendations, authenticated recommendations, and verified availability remaining unchanged.

Use local assets and approved mocks only. Tests must not call production services, modify production data, require real credentials, depend on live model output, or snapshot private profile payloads.

## Validation

Run the repository's formatter, lint, strict type checking, focused unit and integration tests, profile API and authorization tests, migration tests, session-cookie regressions, recommendation regressions, and production build. Manually verify every avatar thumbnail, selection state, save/retry behavior, light and dark themes, keyboard-only use, 200% zoom, and all required viewports. Inspect the built client for missing assets, secrets, private identifiers, and broken filename paths.

Fix failures caused by this work. Do not suppress errors, weaken lint or TypeScript rules, remove relevant tests, or broaden types to bypass validation.

## Completion report

Report:

- the existing Milestone 7 profile/avatar implementation found;
- every supplied avatar and its final stable ID, label, and repository path;
- the selected default and why;
- schema, migration, API, validation, authorization, caching, and account-deletion changes;
- selection, save, failure, fallback, concurrency, and stale-response behavior;
- every file changed and command run;
- test, lint, type-check, migration, and build results;
- viewports, themes, zoom, keyboard, and accessibility checks completed;
- confirmation that all 12 supplied images are present and selectable;
- confirmation that country, providers, languages, feedback, watchlist, watched history, recommendation precedence, verified availability, authentication, and `SameSite=Lax` behavior remain intact;
- confirmation that avatar selection has no recommendation effect;
- confirmation that uploads, external image URLs, social features, Letterboxd, deployment, and production changes were not added;
- remaining risks or follow-up work.

Milestone 7.5 is complete only when all 12 supplied Scouty images are bundled and selectable by authenticated users, the selected stable avatar ID persists safely, default and failure behavior are deterministic, cross-user writes are impossible, the picker is accessible and responsive, Milestone 7 and earlier features remain intact, relevant tests pass, and the production build succeeds.
