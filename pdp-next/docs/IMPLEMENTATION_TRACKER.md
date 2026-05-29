# Implementation Tracker

Status: Active
Last Updated: 2026-05-29 (Planning Redesign — UX Layer)
Owner: Engineering

## Source of Truth Links
- Documentation index: 00_DOC_SYSTEM_INDEX.md
- Product strategy: 10_PRODUCT_STRATEGY_AND_DECISIONS.md
- Product spec: 20_PLANNING_REDESIGN_PRODUCT_SPEC.md
- Engineering blueprint: 21_PLANNING_REDESIGN_ENGINEERING_BLUEPRINT.md
- Mobile flattening spec: 22_MOBILE_SURFACE_FLATTENING_SPEC.md

## Current Phase
Planning redesign UX layer — surfacing the Goals → Commitments → Tasks data model across all planning and execution surfaces.

## Data Model (Finalized)
- **Goals** — long-term anchors (professional / personal, timeframe-scoped)
- **Child Goals** — sub-goals nested under a parent Goal
- **Commitments** — cycle-level priorities (weekly / quarterly), optionally linked to a Goal
- **Tasks** — execution units, optionally linked to a Goal (or child goal) and/or a Commitment
- Coherence rule: if a Task has both `parentGoalId` and `commitmentId`, and the Commitment has a `linkedGoalId`, the Task's root goal must match the Commitment's linked Goal
- `unplanned` flag: `true` when `parentGoalId === null && commitmentId === null`

## Now
1. Visual QA across Planning, Today, and Calendar surfaces for commitment badges and priority sorting.
2. Audit remaining task creation paths for correct `unplanned` derivation.
3. Validate node-map and journal workspaces for any stale task-card patterns.

## Next
1. Commitment carryover UX — surface the carryover workflow in Planning panel when a weekly cycle ends.
2. Quarterly preview — show commitment rollup aggregated to quarterly level in Planning panel.
3. Commitment-scoped task filtering — allow filtering task views by commitment in Calendar and Today.

## Later
1. Data export and calendar interoperability (iCalendar subscription link for tasks/goals).
2. PWA offline mutation queue — surface queued mutations count in UI, allow manual flush.
3. Remove or archive any remaining legacy planning code paths.

## Completed (Overhaul Branch — feat/app-overhaul-implementation)

### Mobile Surface Flattening
- ✅ Shared mobile flattening class/token pass in globals.css
- ✅ Workspace shell + Today + Planning mobile container depth flattened
- ✅ Habits, Journal, Calendar mobile surfaces flattened
- ✅ Mobile/desktop regression pass for hierarchy and theming

### Planning Backend Foundation
- ✅ InstantDB schema: `planningCycles`, `planningCommitments` entities defined and pushed
- ✅ `tasks.commitmentId` optional indexed string added to schema and pushed remotely
- ✅ Perms updated: owner-scoped read/write for planning entities
- ✅ Planning cycle and commitment REST API routes (`/api/planning/cycles`, `/api/planning/commitments`)
- ✅ Daily-focus persistence route (`/api/planning/daily-focus`)
- ✅ Commitment carryover route (`/api/planning/commitments/[id]/carryover`)

### Planning UX Layer
- ✅ Planning Preview Panel: commitment list with linked task count badges, goal badges, inline task list
- ✅ Focus Today Panel: commitment-aware task priority sort; commitment badges on task cards; standalone task label
- ✅ Calendar Workspace: load PlanningCommitments; parent goal + commitment selects in create/edit modals; commitment hierarchy bits in events/agenda/preview; `unplanned` flag computed correctly on create and edit
- ✅ Goal task card (migration-data-preview): commitment badge shown inline on task cards
- ✅ Calendar filter panel, legend, and Today's agenda panel theming fixed (pdp-card / pdp-panel-muted)
- ✅ `home-experience.tsx` dead handler cleanup

## Notes
- App is pre-production; intentional destructive cleanup is allowed when it removes conflicting legacy patterns.
- Any `bg-white`, `bg-slate-50`, `bg-slate-100` outside `.pdp-modal-theme` or `.pdp-shell` scope will not honor the theme — always use `pdp-card`, `pdp-panel`, `pdp-panel-muted`, or `pdp-solid-surface` for themed surfaces.
- Soft-delete retention is 60 days; `purgeAt` is set server-side on archive.
