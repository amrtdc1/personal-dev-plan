# Implementation Tracker

## Current Phase
- Phase 1 foundation complete; core parity and schema hardening in progress
- Quick enablement completed: starter D1 allowlist + ESPN provider scaffold for post-parity theming track
- Protected owner-scoped API foundation is in place for goals/subgoals/tasks read and write paths

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
- [ ] Implement college athletics theme pack (logo + school colors)
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
	- Slice 1: Theme token architecture + profile fields + manual seeded teams.
	- Slice 2: API integration + searchable team picker + logo rendering.
	- Slice 3: Dark/light auto-derivation tuning + accessibility QA + persistence hardening.

## Status Check
- On track with the migration sequence: foundation, auth, profile bootstrap, repository-backed CRUD slices, and lifecycle primitives are complete.
- Protected route coverage for goals/subgoals/tasks reads and writes is substantially complete and now needs hardening/test depth.
- Current gap is expected: offline queueing, calendar export, and deployment smoke-testing are still pending by design and have not been skipped.
- No current work has diverged from the agreed architecture of Next.js + InstantDB + incremental in-place migration.
- College athletics theming is now explicitly in-plan as a post-parity enhancement track, so it will not get lost while migration-critical work continues.
