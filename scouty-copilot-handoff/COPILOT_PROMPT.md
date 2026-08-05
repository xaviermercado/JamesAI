# Implement the approved Scouty.ca visual redesign

Work in Agent mode with the complete repository open. Implement the approved Scouty.ca homepage and shared visual system using the supplied assets. This is a production UI refactor, not a static mockup recreation.

## Brand decision

- Public product and website name: **Scouty.ca**
- User-facing mascot/guide: **Scouty**, a friendly flat 2D blue raccoon wearing a generic scout-inspired khaki shirt and navy neckerchief
- Internal recommendation engine: **JamesAI**
- Public-facing copy, metadata, navigation, authentication screens, email templates, alt text, and legal-page brand references should use Scouty.ca where appropriate.
- Do not blindly rename stable backend packages, database names, environment variables, API contracts, service identifiers, or migrations that use JamesAI. Rename an internal identifier only when it leaks into the user experience or when the rename is demonstrably safe.
- A subtle footer/About statement may say: “Scouty recommendations are powered by JamesAI.”

## Supplied design files

Locate this handoff folder and use:

- `assets/scouty-homepage-reference.png` as the visual source of truth only
- `assets/scouty-hero-background.png` as the hero background
- `assets/scouty-hero-mascot.png` as the separately positioned responsive mascot
- `assets/scouty-favicon.ico` as the favicon
- `design-tokens.css` as the approved token reference

Do not ship the reference mockup as a full-page image. Build the interface from accessible semantic components and live data.

## Required process before editing

1. Inspect the framework, route structure, styling system, shared UI components, authentication state, recommendation flow, TMDB response mapping, image helper, tests, and build scripts.
2. Summarize the existing implementation and list the files you intend to change.
3. Identify any uncommitted user work and preserve it.
4. Reuse the existing recommendation and authentication behavior. Do not create a second data flow or auth system.
5. Follow existing project conventions where they are sound; introduce tokens and reusable components where the current page is monolithic or duplicated.
6. If repository instructions require plan approval, stop after the plan. Otherwise implement, test, and report.
7. Do not deploy, change production data, run production migrations, or alter secrets.

## Visual direction

Create a “cinematic midnight with playful Scouty accents” experience: polished and modern, but warm and approachable rather than dark or technical.

Use these core colours:

- Midnight navy `#0B1633` for header, hero, and footer
- Deep navy `#07152F` and blue `#123A78` for hero depth
- Scouty blue `#3478F6` for primary actions and links
- Bright cyan `#45C8F5` for focus and selected states
- Coral `#FF5D5D` for the Create Account CTA and small high-value accents
- Canvas `#F5F7FF`
- White `#FFFFFF`
- Ink `#172033`
- Muted slate `#667085`

Use **Sora** for display headings, movie titles, brand text, and buttons. Use **Inter** for body copy, forms, metadata, and navigation. Load fonts using the project’s established web/native approach and include sensible system fallbacks. Avoid layout shift.

Meet WCAG AA contrast. Never use colour as the only state indicator. All controls need clear hover, active, disabled, loading, and `:focus-visible` states.

## Header/navigation

Build a compact midnight navigation bar that is visually distinct from the rounded hero beneath it.

Anonymous state:

- Scouty face mark plus `Scouty.ca` wordmark on the left, linked to Explore/Home
- `Log in` text action on the right
- coral `Create account` button on the right

Authenticated state:

- Replace Log in/Create account with a compact profile/avatar control or the user’s first/display name
- Put Profile and Log out in an accessible account menu or appropriate profile navigation
- Do not expose session status, tokens, raw auth terminology, or debug controls

On small screens, keep the brand visible and collapse secondary navigation into an accessible menu. Do not hide authentication access completely.

## Homepage hero

Build a rounded hero (`24–30px` desktop radius) below the navigation. Use the supplied background as a decorative cover layer with an additional CSS gradient/overlay to guarantee text contrast.

Desktop layout:

- Two columns, approximately 56% content / 44% mascot
- Left side contains the live recommendation UI
- Right side positions the standalone Scouty asset near the bottom; preserve the full ears, feet, film strip, popcorn, and tail
- The mascot must not intercept pointer events

Hero copy:

- Heading: `What should we watch tonight?`
- Supporting line: `Tell Scouty your mood, occasion, or oddly specific craving.`
- Prompt placeholder: `I’m in the mood for something…`
- Secondary action: `Filters`
- Primary action: `Find something to watch`

Reuse the current recommendation request, filter state, validation, and response behavior. Do not replace working logic with mock data.

The prompt may be a textarea or appropriately sized input based on current behavior. It must have a real label available to assistive technology, sensible character guidance if already enforced, Enter/submit behavior that does not surprise multiline users, prevention of duplicate requests, and a clear loading state.

Remove production-facing technical text such as `Backend online`, raw errors, request payloads, or API status indicators.

Responsive behavior:

- Tablet: reduce mascot size and keep copy readable
- Mobile: stack content; prioritize heading, prompt, and primary action; place Scouty below or partially beside the copy without covering controls
- Buttons become full-width where helpful
- Do not use fixed hero heights that clip localized text or validation messages
- Respect reduced-motion preferences

## Loading, empty, and error states

Keep Scouty’s personality in the UX without putting him in every movie card.

- Loading: friendly copy such as `Scouty is searching…` with a restrained progress treatment or card skeletons
- Empty initial state: `Scouty is ready when you are.`
- No results: explain that no close matches were found and offer to adjust filters or prompt
- Error: safe, human language with Retry where appropriate; never show raw server exceptions or JSON
- Preserve prior results while a refresh is underway when that matches current product behavior

Do not create new mascot illustrations unless necessary. Reuse the supplied mascot and use CSS/layout treatment for these states.

## Recommendation results

Replace the oversized horizontal result rows with a responsive, scannable grid of portrait cards. Use live recommendation data.

Section heading: `Scouty found these for you`

Image rules are critical:

- TMDB `poster_path` is portrait and must be displayed at `aspect-ratio: 2 / 3`
- Use `object-fit: cover` only inside that same 2:3 poster frame
- Do not force poster images into 16:9 containers
- If a deliberate horizontal card is ever used, use `backdrop_path`, not `poster_path`
- Use the project’s TMDB image URL helper/configuration; do not hardcode fragile URLs if a helper exists
- Provide a polished fallback when an image is missing or fails
- Set meaningful alt text such as `[Movie title] poster`, or empty alt when adjacent visible text makes the image redundant according to the component’s accessibility choice
- Avoid layout shift by reserving the aspect ratio
- Lazy-load below-the-fold posters where supported

Grid guidance:

- Use CSS grid with `repeat(auto-fit, minmax(...))` or the platform equivalent
- Aim for four cards across at large desktop, two at tablet widths, and one or two on mobile based on actual readable card width
- Use `20–24px` gaps
- Do not squeeze five unreadable cards into a viewport simply because five recommendations exist

Each card should support, when the data exists:

- Full portrait poster
- Rating badge over the poster near the lower-left or upper-right
- Movie title
- Release year and runtime
- Restrained genre chips
- Concise overview with a consistent line clamp and an accessible More/details path
- `Why Scouty picked it` explanation
- Streaming provider names/logos from the existing provider data
- Like, Not for me, and Watched actions

Feedback controls must be real buttons with icons plus accessible names. Preserve the existing feedback API. Show selected/pending/success/error states without optimistic state becoming permanently incorrect after a failed request.

Card style:

- White surface, subtle border, `18–22px` radius
- Soft shadow from the supplied tokens
- Restrained hover lift only for pointer devices and only when reduced motion is not requested
- Keep metadata visually quieter than title and recommendation reason
- Coral is a sparse accent; do not use it on every element

## Filters

Keep Filters secondary to the main prompt. Reuse current filters and validation.

- Desktop: use an expandable panel, popover, or drawer consistent with the component system
- Mobile: use an accessible sheet or stacked panel
- Clearly indicate active filters and provide Clear all
- Opening/closing must support keyboard and screen-reader use
- Do not discard entered prompt text when filters open or close

## Page structure after results

Use this order:

1. Header/navigation
2. Rounded cinematic hero
3. Recommendation results or appropriate state
4. A concise “How Scouty picks” explanation only if it adds real trust/value
5. Dark footer with About, Privacy, and Terms when those routes exist
6. Optional subtle `Recommendations powered by JamesAI` line

Do not invent broken links. If legal/About routes do not exist, identify that gap rather than linking to `#`.

## Authentication integration

Preserve the previously requested production auth separation:

- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/verify-email`
- `/profile`
- `/profile/edit`
- `/profile/streaming-services`

Do not recreate the old combined Account Center or show `unauthenticated`, `Account: none`, `refresh session`, token data, or developer diagnostics.

Apply the Scouty.ca header, tokens, typography, fields, buttons, and focused-card styling to auth screens. Authentication remains optional for anonymous recommendations. Protected profile routes remain protected. Signup must retain first name, last name, email, password, and confirm-password behavior through the full validated API/database flow already requested.

Do not weaken secure HTTP-only cookie/session behavior or move sensitive session data into localStorage/ordinary AsyncStorage.

## Component and code organization

Adapt names to the repository, but aim for clear equivalents of:

- `AppHeader`
- `HeroRecommendationForm`
- `FilterPanel`
- `RecommendationGrid`
- `MovieRecommendationCard`
- `MoviePoster`
- `FeedbackActions`
- `ScoutyStateMessage`
- `AppFooter`
- central theme/tokens

Screen/route components should coordinate state and composition, not contain duplicated API clients, authentication logic, or enormous blocks of presentation code. Keep session restoration centralized. Preserve working request/response types and extract shared logic only where it materially reduces duplication.

Use framework-native optimized image components where appropriate, while preserving the 2:3 layout and supporting the supplied local hero assets. If remote image hosts require an allowlist/config entry, update it narrowly for the existing TMDB host.

## Accessibility and quality

- Semantic landmarks: header, nav, main, section headings, footer
- Exactly one clear page `h1`
- Logical heading order
- Visible keyboard focus
- Proper labels and error association for forms
- Minimum practical touch target around 44px
- Menus, sheets, dialogs, and filter panels manage focus correctly
- Do not trap keyboard focus outside a real modal
- Support zoom and reflow at narrow widths
- Test long titles, missing metadata, broken images, slow requests, and empty provider lists
- Do not rely on hover for required information

## SEO and brand metadata

Update user-facing metadata to Scouty.ca:

- Document/app title and title template
- Description focused on personal movie discovery
- Favicon reference using the supplied `.ico`
- Open Graph/Twitter text where already supported
- Theme colour using midnight navy
- Accessible logo/brand labels

Do not fabricate a canonical production URL if configuration does not provide one. Do not expose JamesAI in prominent page titles unless the product explicitly calls for the subtle powered-by credit.

## Tests and verification

Add or update tests for:

- Anonymous header and authenticated header states
- Hero submits through the existing recommendation flow
- Duplicate submission prevention and loading state
- Filters preserve prompt and active state
- Poster uses a 2:3 frame and correct TMDB field/helper
- Missing/broken poster fallback
- Results render responsively without clipped movie art
- Long title/overview behavior
- Feedback action success and failure
- Loading, empty, no-results, and safe error states
- Keyboard and accessible labels for nav, prompt, filters, feedback, and menus
- No technical backend/session text remains user-facing
- Public brand text is Scouty.ca while stable JamesAI internals remain functional
- Anonymous recommendations still work
- Login/signup/profile routing and guards still work

Then run the repository’s relevant:

- Unit/integration tests
- Lint
- Strict TypeScript/type checking
- Frontend and backend production builds

Fix regressions introduced by this work. Do not silence errors with broad `any`, disabled lint rules, removed tests, or weakened assertions.

## Final report

Report:

1. What changed visually and structurally
2. Every created/changed file
3. How supplied assets were integrated
4. Responsive breakpoints/behavior
5. Accessibility decisions
6. TMDB poster/backdrop handling
7. Tests and build commands with results
8. Remaining issues or assumptions
9. A desktop/tablet/mobile manual QA checklist

Stop before deployment. The work is accepted only when the page is implemented from real components and live data, poster artwork is no longer incorrectly cropped, Scouty.ca is the public brand, the mascot/background respond cleanly across screen sizes, authentication remains production-oriented and separated, and all relevant checks pass.
