# Implementation Tracker

## Current Phase
- Phase 1 foundation and first data slices in progress
- Quick enablement completed: starter D1 allowlist + ESPN provider scaffold for post-parity theming track

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
- On track with the migration sequence: foundation first, then auth, then profile bootstrap, then repository-backed reads.
- Current gap is expected: writes, parity mapping, offline queueing, and calendar export are still pending by design and have not been skipped.
- No current work has diverged from the agreed architecture of Next.js + InstantDB + incremental in-place migration.
- College athletics theming is now explicitly in-plan as a post-parity enhancement track, so it will not get lost while migration-critical work continues.
