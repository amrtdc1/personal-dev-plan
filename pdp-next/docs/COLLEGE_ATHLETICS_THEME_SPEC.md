# College Athletics Theme System (Short Technical Spec)

## Purpose
Add an optional college athletics theming mode where users can select a school and automatically apply:
- School logo
- 2-3 school primary colors
- Accessible light and dark theme variants

This is an enhancement track and is scheduled after core parity milestones are stable.

## Product Decisions (Locked)
- Provider: ESPN public APIs (`https://site.api.espn.com/apis/site/v2/` and `https://site.web.api.espn.com/apis/site/v2/`)
- Auth: none
- Catalog scope (v1): NCAA Division I only
- Theme identity model: school-global branding (not sport-specific)
- Default source sport/league: NCAA football
- Color source strategy: API-first, curated overrides when provider colors are poor/incomplete
- Logo placement (v1):
  - Header/nav badge
  - Theme picker preview cards
  - Subtle background watermark
- Light/dark behavior: auto-derive both variants from school colors
- Fallback on failures: neutral grayscale theme
- Licensing constraints currently provided: none
- Delivery target after parity checkpoint: two-sprint full v1

## UX Scope (v1)
- New theme mode in preferences: `College Athletics`
- Team picker with search/filter (NCAA D1 catalog)
- Live preview card before applying
- Apply + persist theme to profile
- Revert to default theme action

## Technical Scope

### 1) Data Model Additions
Extend user profile preferences with:
- `themeMode`: `"system" | "light" | "dark" | "college"`
- `collegeTeamId`: provider team id (string)
- `collegeTeamName`: school display name
- `collegeLogoUrl`: selected logo URL
- `collegeColors`: normalized color token payload
  - `primary`
  - `secondary`
  - `accent` (optional)
- `collegeThemeVersion`: integer for future migrations

Optional cache entity for provider resilience:
- `collegeTeamsCache`
  - provider id, name, league, logo URL, color payload, fetchedAt

### 2) API Integration Layer
Create a dedicated provider adapter:
- `src/lib/theming/providers/espn-college.ts`
- Responsibilities:
  - Fetch NCAA D1 school list
  - Fetch team branding payload (logo + color metadata)
  - Normalize into internal shape

Notes:
- Confirmed list endpoint from provided sample:
  - `GET https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams`
- Confirmed payload fields from provided sample:
  - Team id: `sports[].leagues[].teams[].team.id`
  - Display name: `...team.displayName`
  - Primary color: `...team.color`
  - Secondary color: `...team.alternateColor` (optional)
  - Logos: `...team.logos[]` with multiple variants and `rel[]`
- Important: this payload includes many schools outside NCAA D1, so adapter must apply a D1 filter pass before exposing picker results.
- Use football route as primary source; keep adapter extensible for fallback source routes if branding fields are missing.

#### Normalization Rules (v1)
- Colors:
  - Convert ESPN hex strings without hash (`"3f1f69"`) to canonical format (`"#3f1f69"`).
  - `primary` = `team.color` when valid.
  - `secondary` = `team.alternateColor` when valid and distinct; otherwise derive from `primary`.
  - `accent` = derived token from primary/secondary contrast logic.
- Logos:
  - Prefer variants by `rel[]` in this order when available:
    - `primary_logo_on_white_color`
    - `full` + `default`
    - first valid `logos[].href`
  - Keep optional dark-context fallback logo when available:
    - `primary_logo_on_black_color` or `full` + `dark`
  - Persist both selected default and dark fallback URLs in normalized theme payload.
- Team identity:
  - Persist ESPN `team.id` as `collegeTeamId`.
  - Persist `displayName`, `abbreviation`, and `slug` for search and stable rendering.

#### D1 Filtering Strategy (Required)
- Since the `/teams` football payload is broad, adapter must filter to D1 schools before presenting picker options.
- v1 implementation approach:
  - Maintain a curated D1 allowlist table keyed by ESPN `team.id`.
  - During fetch normalization, include teams only when `team.id` exists in allowlist.
  - Keep allowlist versioned so updates are controlled and testable.
  - Starter artifacts added:
    - `src/lib/theming/data/espn-d1-allowlist.json`
    - `scripts/generate-d1-allowlist.mjs` (regen script)
    - `src/lib/theming/providers/espn-college.ts` (provider scaffold + normalization)

### 3) Theme Token Pipeline
Create a token mapper:
- Input: provider colors + mode (`light`/`dark`)
- Output: CSS variable set used by app theme system

Suggested token set:
- `--theme-bg`
- `--theme-surface`
- `--theme-text`
- `--theme-muted-text`
- `--theme-primary`
- `--theme-primary-contrast`
- `--theme-secondary`
- `--theme-accent`
- `--theme-border`

Rules:
- If provider colors are missing/invalid, use curated override table.
- If still invalid, fallback to neutral grayscale.
- Enforce contrast checks for text over primary/surface (AA target).

### 4) Logo Rendering
- Header badge: compact logo + school short name
- Theme picker cards: logo preview with primary/secondary swatches
- Watermark: low-opacity background logo with safe contrast and no interaction impact

Image constraints:
- Restrict remote image domains via Next image config.
- Validate and sanitize URL fields before render/persist.

## Accessibility and Safety Requirements
- WCAG AA contrast for key text/surface pairings
- Keyboard accessible picker and apply/revert controls
- Reduced-motion-respecting transitions
- Graceful failure states:
  - API unavailable
  - Team data incomplete
  - Logo fetch errors

## Delivery Plan (Post-Parity)

### Sprint A (Foundation + Picker)
- Add profile fields and persistence hooks
- Build ESPN adapter and normalization pipeline
- Build team picker with search and preview cards
- Render header badge + picker visuals
- Add grayscale fallback path

### Sprint B (Polish + Hardening)
- Dark/light derivation tuning
- Watermark rendering and safe opacity behavior
- Curated color override table for bad provider data
- Cache strategy and stale refresh behavior
- Accessibility pass + visual QA across desktop/iPad/mobile

## Acceptance Criteria
- User can choose `College Athletics` mode and select a NCAA D1 school
- App applies school logo and mapped colors in light and dark variants
- Theme persists across sessions
- Missing/invalid provider data falls back to neutral grayscale without app breakage
- Contrast checks pass for key UI text/surfaces

## Non-Goals (v1)
- Non-NCAA D1 divisions
- Sport-specific per-team themes
- Per-user manual color editing UI
- Animated logo treatments

## Dependencies and Risks
- ESPN payload shape inconsistency across endpoints
- Team color quality variability
- Remote image availability/performance

Mitigations:
- Provider adapter abstraction
- Curated overrides table
- Fallback theme and cached team metadata
