# PDP Next Product Strategy and Decisions

Status: Active
Last Updated: 2026-05-29 (Mobile Overhaul Alignment)
Owner: Product + Engineering

## Mission
Build a simple but robust personal planning system that helps users move from long-term direction to weekly and daily execution.

## Current Product Direction
- Keep existing workspace IA: Today, Planning, Habits, Journal, Calendar, Profile.
- Improve planning quality with a weekly-first rhythm.
- Keep interactions lightweight and fast for daily use.
- Preserve optional personal/professional split.
- First UI overhaul priority is mobile surface flattening to reduce nested panel clutter.

## Locked Decisions
1. Planning model
- Use Direction -> Commitment -> Execution layers.
- Direction: long-term and annual goals.
- Commitment: quarterly and weekly commitments.
- Execution: daily Big 3 and supporting tasks.

2. Simplicity constraints
- Annual active goals cap: 5
- Weekly commitments cap: 3
- Daily Big 3 cap: 3

3. Integration philosophy
- Reuse existing goals/tasks/habits/journal/calendar surfaces.
- Avoid full IA overhaul.
- Favor intentional cleanup over backward compatibility where legacy patterns add noise.

4. UI hierarchy strategy
- Mobile-first flattening is required for signed-in workspace surfaces.
- Desktop can retain richer surface depth where it improves scanning.
- Borders are not a default separator on mobile; spacing and typography lead hierarchy.

5. Lifecycle stage
- Pre-production testing phase.
- Destructive cleanup is allowed when it improves architecture clarity and reduces future maintenance risk.

## Priority Outcomes
- Users can complete weekly planning in under 5 minutes.
- Users can choose daily Big 3 in under 60 seconds.
- Users can review weekly outcomes and carryover quickly.
- Users should not encounter repeated nested borders that reduce mobile readability.

## First Overhaul Slice
- Mobile Surface Flattening Spec: 22_MOBILE_SURFACE_FLATTENING_SPEC.md
- This slice is executed before planning backend expansion.

## Not In Scope
- Team collaboration workflows.
- Enterprise governance features.
- Heavy reporting stacks.
