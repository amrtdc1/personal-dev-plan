# Planning Redesign Product Spec

Status: Active
Last Updated: 2026-05-29 (Mobile Overhaul Alignment)
Owner: Product

## Objective
Redesign planning so users can reliably move from long-term goals to weekly commitments and daily action without overwhelming complexity.

## User Problem
Current planning supports goal and task management but lacks a clear ritualized flow from horizon planning to daily execution.

## Product Goals
1. Weekly-first planning cadence.
2. Strong focus constraints to reduce priority overload.
3. Better execution insight from planned vs unplanned behavior.
4. Minimal disruption to current workspace architecture.
5. Cleaner mobile experience by reducing nested bordered containers.

## First Overhaul Priority
Before deeper planning feature expansion, execute mobile surface flattening:
- Reference: 22_MOBILE_SURFACE_FLATTENING_SPEC.md
- Constraint: keep existing IA; improve visual hierarchy inside existing workspaces.

## Experience Model
### Layer 1: Direction
- Long-term and annual goals establish direction.

### Layer 2: Commitment
- Quarterly and weekly commitments express what will actually be advanced.

### Layer 3: Execution
- Daily Big 3 identifies top actions for the day.
- Supporting tasks remain available for queue management.

## Core Rituals
1. Weekly Preview
- Review prior week.
- Set weekly Big 3 commitments.
- Confirm schedule and carryover decisions.

2. Quarterly Preview
- Review quarterly progress.
- Set or adjust quarterly Big 3.
- Update confidence and risks.

3. Daily Startup
- Select daily Big 3 from weekly commitments and urgent work.

4. Daily Close
- Capture outcomes and adjustments.

## Workspace Changes
### Planning
- Add current cycle summary.
- Add guided Weekly Preview panel.
- Add guided Quarterly Preview panel.
- Keep existing goal and task lanes.
- On mobile, flatten nested panel depth and prefer drill-in views over concurrent nested bordered lanes.

### Today
- Add Daily Big 3 strip.
- Add task source badges: weekly, quarterly, unplanned.
- Add queue filter: On Plan.
- On mobile, flatten card-within-card depth and keep one strong section container at a time.

### Habits
- Optional commitment linkage.
- Show linked habit adherence in planning context.
- On mobile, flatten metric/list wrappers to reduce border noise.

### Journal
- Add weekly and quarterly review templates.
- Save cycle tags for later insight.
- On mobile, flatten filter and entry wrappers where nested border depth is redundant.

### Calendar
- Add overlays for weekly commitments and quarterly milestones.
- On mobile, flatten controls and filter wrappers while preserving event legibility.

## Key Rules
- Weekly commitments max: 3.
- Daily Big 3 max: 3.
- Commitments should link to goals when possible.
- Carryover should be explicit and measurable.

## Acceptance Criteria
1. User can create and complete a weekly cycle with up to 3 commitments.
2. Daily Big 3 can be set and edited with max 3 items.
3. Planned vs unplanned execution is visible in Today insights.
4. Weekly carryover metrics are captured.
5. Existing goal/task CRUD remains functional.
6. Mobile signed-in surfaces do not present repeated nested border boxes that harm readability.
7. Desktop scanability remains intact after mobile flattening changes.
