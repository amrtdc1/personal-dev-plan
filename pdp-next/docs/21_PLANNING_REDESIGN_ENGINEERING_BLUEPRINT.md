# Planning Redesign Engineering Blueprint

Status: Active
Last Updated: 2026-05-29 (Mobile Overhaul Alignment)
Owner: Engineering

## Objective
Provide implementation-ready contracts, rollout slices, and validation strategy for the planning redesign.

## Architecture Constraints
- Extend existing Next.js + InstantDB architecture.
- Keep owner-scoped route patterns and validation conventions.
- Support intentional cleanup and removal of legacy behaviors that conflict with the redesigned planning model.
- Keep existing IA while executing mobile surface flattening as the first overhaul.

## First Overhaul Slice (UI/UX)
Reference: 22_MOBILE_SURFACE_FLATTENING_SPEC.md

Implementation goals:
1. Reduce nested border/shadow depth on mobile signed-in pages.
2. Preserve desktop readability and hierarchy.
3. Centralize style behavior in semantic classes and global tokens before component-level tweaks.

Technical targets:
- src/app/globals.css
- src/components/dashboard/workspace-shell.tsx
- src/components/dashboard/dashboard-insights.tsx
- src/components/dashboard/migration-data-preview.tsx
- src/components/dashboard/habits-workspace.tsx
- src/components/dashboard/journal-workspace.tsx
- src/components/dashboard/calendar-workspace.tsx

## Domain Entities
### PlanningCycle
- id
- ownerUid
- cycleType: weekly | quarterly
- startDate
- endDate
- status: active | completed | archived
- reviewSummary
- createdAt
- updatedAt

### PlanningCommitment
- id
- ownerUid
- cycleId
- level: weekly | quarterly
- domain: professional | personal | mixed
- title
- linkedGoalId
- rank: 1 | 2 | 3
- status: not_started | in_progress | done | dropped
- carryoverFromCommitmentId
- confidenceScore (quarterly)
- createdAt
- updatedAt

### DailyFocusPlan
- id
- ownerUid
- planDate
- commitmentIds (max 3)
- taskIds (max 3)
- notes
- createdAt
- updatedAt

## API Surface
1. Cycles
- GET /api/planning/cycles
- POST /api/planning/cycles
- PATCH /api/planning/cycles/:cycleId
- POST /api/planning/cycles/:cycleId/complete

2. Commitments
- GET /api/planning/commitments
- POST /api/planning/commitments
- PATCH /api/planning/commitments/:commitmentId
- DELETE /api/planning/commitments/:commitmentId
- POST /api/planning/commitments/:commitmentId/carryover

3. Daily Focus
- GET /api/planning/daily-focus?date=YYYY-MM-DD
- PUT /api/planning/daily-focus?date=YYYY-MM-DD

## Validation Rules
- Weekly commitments per cycle: <= 3
- Daily focus commitments: <= 3
- Daily focus tasks: <= 3
- Owner-scoped checks on all linked entities
- Reject links to deleted entities

## UI Integration Targets
- Planning shell: src/components/dashboard/migration-data-preview.tsx
- Today shell: src/components/dashboard/dashboard-insights.tsx
- Habits shell: src/components/dashboard/habits-workspace.tsx
- Journal shell: src/components/dashboard/journal-workspace.tsx
- Calendar shell: src/components/dashboard/calendar-workspace.tsx

## Rollout Slices
### Slice 1
- Mobile surface flattening foundation:
	- semantic class + token updates
	- workspace shell flattening
	- Today + Planning mobile cleanup pass

### Slice 2
- Remaining mobile flattening pass for Habits, Journal, Calendar.
- Regression QA for desktop hierarchy and theming.

### Slice 3
- Schema and route foundations for cycles and commitments.
- Weekly preview UI shell and basic commit flow.

### Slice 4
- Daily Big 3 persistence and Today integration.
- On Plan filter and planned/unplanned insight tightening.

### Slice 5
- Quarterly preview flow and confidence/risk capture.
- Carryover endpoint and analytics linkage.

### Slice 6
- Journal template integration and cycle tagging.
- Calendar commitment overlays and polish.

## Test Strategy
1. Unit
- cap validation
- carryover logic
- ranking and conflict checks

2. Route
- auth ownership guards
- validation errors
- conflict responses

3. Component
- weekly preview interactions
- daily big 3 interactions
- on plan filtering

4. Regression
- existing goal/task CRUD and ordering
- habits check-ins
- journal archive/restore/delete
- calendar interactions
- mobile viewport surface hierarchy checks (no repeated nested border stacks)
- desktop hierarchy stability checks after mobile flattening
