# Implementation Tracker

## Current Phase
- Phase 1 foundation complete; core parity closure and security hardening in progress
- Phase 0 PWA install/push foundation is now in implementation (banner UX, subscription API, schema/perms, SW handlers)
- College theming track is now implemented end-to-end (palette/CWM/college source, logo rendering, profile persistence)
- Protected owner-scoped API foundation is in place for goals/subgoals/tasks read and write paths, with profile writes now routed server-side
- Release-readiness execution board is tracked in `docs/RELEASE_READINESS_TASK_BOARD.md`

## Milestones
- [x] Scaffold Next.js app in-repo (`pdp-next`)
- [x] Add environment template for migration
- [x] Add initial migration tracker
- [x] Build shared domain types for goals/subgoals/tasks/journal/users
- [x] Add auth + InstantDB baseline wiring
- [x] Implement first user bootstrap flow
- [x] Implement first repository-backed reads (`userProfiles`, `goals`)
- [x] Implement first repository-backed goal create/update flows
- [x] Define feature parity matrix from legacy app
- [x] Implement soft-delete lifecycle primitives (60-day retention)
- [x] Implement status and ordering parity for goals/subgoals/tasks
- [ ] Implement core Goals/Sub-goals/Tasks parity
- [ ] Implement offline-first write queue and sync UX
- [ ] Implement ICS export + tokenized subscription feed
- [x] Implement college athletics theme pack (logo + school colors)
- [ ] Complete staged cutover from legacy app

## Immediate Next Tasks
- [x] Build legacy parity checklist from current `main.js`
- [x] Add repository-backed subgoal and task reads
- [x] Add repository-backed subgoal and task write flows
- [x] Add architecture ADR for auth provider decision
- [x] Add baseline security checklist (XSS, ownership checks, destructive actions)
- [x] Generate starter D1 allowlist from local ESPN payload sample
- [x] Add non-invasive ESPN theming provider scaffold and normalization contract
- [x] Add soft-delete cascade semantics and repository lifecycle tests
- [x] Add status mutation and ordering mutation flows for goals/subgoals/tasks
- [x] Formalize InstantDB schema for fresh-start migration (no Firebase backfill)
- [x] Add first protected server mutation route for goal status updates
- [x] Expand protected status mutation routes for subgoals and tasks
- [x] Expand route-level server-side ownership checks across protected data paths
- [x] Centralize payload validation and shared ownership guard helpers
- [x] Harden protected API error contract (unexpected errors -> safe 500 responses)
- [x] Enforce restore-window retention checks on restore endpoints
- [x] Add protected API tests for auth/ownership/query validation/error mapping
- [x] Implement owner-scoped purge execution for expired soft-deleted records
- [x] Stand up Vercel preview deployment for migration smoke testing
- [x] Wire preview smoke check into PR validation via GitHub Actions deployment status
- [x] Add regression tests for protected write payload parsers (goals/subgoals/tasks)
- [x] Add ESPN logo URL sanitization and remote image domain allowlist guardrails
- [x] Add strict markdown renderer utility with XSS-focused regression tests for journal content
- [x] Enforce persist-path validation for college logo URLs on profile writes
- [x] Integrate strict markdown rendering into repository-backed journal preview flow
- [x] Add repository-backed dashboard insight cards (focus, due soon, at-risk, recently updated)
- [x] Add repository-backed journal workspace with CRUD and mood/tag/goal filters
- [x] Add client-side offline write queue for save flows (goals/subgoals/tasks/journal)
- [x] Add offline sync status panel with pending queue count and manual/auto replay hooks
- [x] Add signed-in header account menu with quick light/dark/system shortcuts and profile access
- [x] Add seeded college team picker + persisted team identity + header team badge
- [x] Add searchable college team picker with FBS/FCS filter and preview cards
- [x] Add live ESPN-backed team catalog route with local fallback for picker resiliency
- [x] Route profile saves through authenticated server API with Instant admin writes
- [x] Push Instant schema/perms updates for profile/theming fields (`themeMode`, `collegeTeamId`, `collegeTeamName`)
- [x] Align branding behavior so logo/watermark follow theme source (palette/CWM/college), not display mode alone
- [x] Add live branding preview parity (header/watermark) while editing Profile & Theme before save
- [x] Retheme calendar toolbar controls (prev/next/today/view toggles) with shared app tokens
- [x] Set returning-user landing behavior to Dashboard while preserving first-login onboarding
- [x] Add install + push opt-in banner scaffold for signed-in shell
- [x] Add owner-scoped push subscription persistence model + API endpoints
- [x] Add service worker push display and notification click handling
- [x] Add VAPID key placeholders to env template
- [x] Add authenticated push test trigger route + server delivery utility
- [x] Add in-app "Send test" notification action for subscribed users
- [x] Add reminder template builder for daily agenda, weekly review, and due-task pushes
- [x] Add reminder send + scheduler-run endpoint scaffold for push cadence integration
- [x] Add in-app reminder-type controls for notification management
- [x] Add InstantDB notification preference and delivery-log entities for reminder backend evolution
- [x] Add authenticated API routes to read/update notification preferences
- [x] Add dashboard surface for reminder schedule, quiet hours, and reminder-type toggles
- [x] Enforce scheduler runtime checks for reminder toggles, preferred hour, weekly cadence, and quiet hours
- [x] Add notification delivery history API and in-app activity panel
- [x] Add reminder-type cooldown policy controls for scheduler over-send protection
- [x] Add delivery history filters + load-more pagination in notification activity panel
- [x] Add scheduler operations summary endpoint for reminder delivery observability
- [x] Add activity time-window filtering and quick status counts in notification history panel
- [x] Add scheduler health card in dashboard via authenticated server-side summary proxy
- [x] Add CSV export for filtered notification delivery activity
- [x] Add stable notification route-core test harness utilities for endpoint logic coverage
- [x] Add signed token issuer and tokenized ICS calendar feed scaffold routes
- [x] Add signed-in Profile UI for copy/open/refresh of tokenized calendar feed URL
- [x] Add calendar feed token rotation semantics (refresh invalidates older URLs)
- [x] Add explicit revoke confirmation UX for calendar feed URL rotation
- [x] Add route-level regression tests for feed token issue/rotate and stale-token rejection
- [x] Add explicit auth failure and missing-profile edge-case tests for calendar feed routes
- [x] Add UI interaction test for calendar feed revoke confirmation flow
- [x] Move scheduler health monitoring surface from Dashboard to Profile & Theme
- [x] Add permanent delete cascade workflow with explicit archived-item confirmation UX
- [x] Add permanent delete action for archived journal entries with explicit confirmation
- [x] Align journal CRUD/archive/restore/delete flows to protected server API routes
- [x] Add route-level regression tests for journal list/detail/archive/restore/delete APIs

## Checkpoint Packaging (Lower Commit Cadence)
- Build and validate a full checkpoint slice before committing (lint, test, build).
- Prefer one commit per completed slice; use two only when separation materially improves reviewability.
- Keep PRs small but complete: implementation + tests + tracker/security doc updates together.

## Planned Enhancement Track: College Athletics Themes
- Reference spec: `docs/COLLEGE_ATHLETICS_THEME_SPEC.md`
- Phase placement: Start after core Goals/Sub-goals/Tasks parity is stable, and complete before final cutover.
- Scope:
	- Add "College Athletics" as a theme mode alongside existing light/dark preferences.
	- Let users choose from a large team catalog powered by a logo/provider API.
	- Apply 2-3 school primary colors to app tokens (surface, accent, emphasis) with contrast-safe fallbacks.
	- Render team logo in designated UI surfaces (header/account/theme preview) with responsive behavior.
	- Support both light and dark mode derivations for each selected team.
- Data model updates:
	- Extend user profile preferences with `themeMode`, `collegeTeamId`, `collegeTeamName`, `collegeLogoUrl`, and normalized palette values.
	- Cache provider payload snapshots for resilience when API rate-limited or unavailable.
- Security and UX constraints:
	- Validate and sanitize logo URLs and remote image domains.
	- Keep text contrast AA-compliant in both light and dark variants.
	- Provide instant preview, revert action, and default fallback theme.
- Delivery slices:
	- Slice 1: Theme token architecture + profile fields + manual seeded teams. (Done)
	- Slice 2: API integration + searchable team picker + logo rendering. (Done)
	- Slice 3: Dark/light auto-derivation tuning + accessibility QA + persistence hardening. (In Progress: tuning/persistence done; accessibility QA pass pending)

## Status Check
- On track with the migration sequence: foundation, auth, profile bootstrap, repository-backed CRUD slices, and lifecycle primitives are complete.
- Protected route coverage for goals/subgoals/tasks reads and writes is substantially complete and now needs hardening/test depth.
- Profile writes now use a protected server route to avoid client permission drift and improve reliability.
- Current gap is expected: deeper offline queue coverage (status/reorder/archive), ICS export/feed, and final parity closeout are still pending by design and have not been skipped.
- No current work has diverged from the agreed architecture of Next.js + InstantDB + incremental in-place migration.
- College athletics theming has moved from planned enhancement track to implemented feature set.

## Visual Parity Checklist (Signed-In Pages)
- Scope: Dashboard, Goals, Calendar, Journal, Profile & Theme.
- Theme modes: verify light, dark, and system (CWM) via top quick-toggle and Profile display mode selector.
- Theme sources: verify palette, CWM, and college-team selections from Profile.
- Container parity: confirm panel layering is visually consistent across all five sections (shell panel -> muted panel -> inner cards).
- Control parity: confirm text inputs, selects, textareas, and secondary/primary action buttons share the same tokenized backgrounds, text, and borders.
- Dark select legibility: verify closed and opened select dropdown text/background remain readable in dark mode.
- Calendar parity: verify event colors and status chips are token-driven and remain distinguishable across palette/CWM/college themes.
- Persistence parity: verify quick-toggle changes and Profile saves persist after refresh and do not conflict with one another.

## Styling Guide (Signed-In UI)

### Source of truth
- Primary style source for signed-in pages is theme tokens in [pdp-next/src/app/globals.css](pdp-next/src/app/globals.css).
- Theme state resolution and token application are handled in [pdp-next/src/components/dashboard/home-experience.tsx](pdp-next/src/components/dashboard/home-experience.tsx).
- Prefer semantic classes below over repeating long Tailwind color/border strings.

### Semantic class contract
- `pdp-panel`: top-level section container.
- `pdp-panel-muted`: secondary panel region inside a section.
- `pdp-card`: nested card/list item surface.
- `pdp-control`: text input, select, textarea base styling.
- `pdp-btn-primary`: primary action button base styling.
- `pdp-btn-secondary`: secondary/neutral action button base styling.
- `pdp-status-chip` + status modifiers: status display (`pdp-status-not-started`, `pdp-status-progress`, `pdp-status-done`).

### Token contract
- Base shell tokens: `--pdp-surface`, `--pdp-muted-surface`, `--pdp-border`, `--pdp-text-strong`, `--pdp-text`, `--pdp-text-muted`.
- Accent tokens: `--pdp-theme-primary`, `--pdp-theme-soft`.
- Status tokens: `--pdp-status-*` background/text pairs.
- Calendar event tokens: `--pdp-event-*` background/border pairs.
- New theme work should extend tokens first, then semantic classes if needed, then component markup.

### Usage rules
- Do use semantic classes as the base and add only spacing/layout modifiers in component markup.
- Do keep one visual hierarchy across signed-in pages: `pdp-panel` -> `pdp-panel-muted` -> `pdp-card`.
- Do keep quick toggle and Profile save behavior aligned through the shared theme flow in [pdp-next/src/components/dashboard/home-experience.tsx](pdp-next/src/components/dashboard/home-experience.tsx).
- Do verify select legibility in dark mode whenever control styling changes.
- Do not hardcode color classes (for example `bg-blue-*`, `text-slate-*`, `border-slate-*`) when a semantic class already applies that role.
- Do not introduce per-component token math unless it is globally reusable; prefer centralized token updates in [pdp-next/src/components/dashboard/home-experience.tsx](pdp-next/src/components/dashboard/home-experience.tsx).

### Change checklist for future UI edits
- Confirm the edited surface uses the semantic class hierarchy.
- Confirm new controls use `pdp-control` and actions use `pdp-btn-primary`/`pdp-btn-secondary`.
- Confirm no hardcoded color utilities reintroduced where semantic classes already cover styling.
- Run lint/build and perform a quick manual pass in light, dark, and system modes.
