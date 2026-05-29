# PDP Next Documentation System Index

Status: Active
Last Updated: 2026-05-29 (Mobile Overhaul Alignment)
Owner: Product + Engineering

## Purpose
This is the source-of-truth index for all active documentation in the Next.js migration workspace.

## Document Precedence
When two docs conflict, follow this precedence order.

1. Product strategy and active design decisions
- 10_PRODUCT_STRATEGY_AND_DECISIONS.md

2. Planning redesign product requirements
- 20_PLANNING_REDESIGN_PRODUCT_SPEC.md

3. Planning redesign implementation details
- 21_PLANNING_REDESIGN_ENGINEERING_BLUEPRINT.md

4. Mobile surface flattening requirements
- 22_MOBILE_SURFACE_FLATTENING_SPEC.md

5. Active delivery tracker
- IMPLEMENTATION_TRACKER.md

6. Operational runbooks and security checklists
- BASELINE_SECURITY_CHECKLIST.md
- DEV_RUNTIME_STARTUP_RUNBOOK.md
- SYNC_API_TRIAGE_CHECKLIST.md
- ADR-0001-auth-provider.md

## Active Scope
This workspace targets a pre-production build with permission for intentional cleanup and destructive refactors when they reduce long-term complexity.
Current first-overhaul focus is mobile surface flattening across signed-in workspaces.

## Archive Policy
- docs/archive/superseded: Prior source-of-truth docs replaced by newer strategy/specs.
- docs/archive/history: Time-bound verification evidence and release snapshots.
- dev-notes/archive/legacy: Legacy vanilla/Firebase-era planning docs.

Archived docs are historical reference only and must not be treated as implementation direction.

## Change Control Rules
1. Every active spec must include Status, Last Updated, and Owner.
2. If replacing a spec, move old file to docs/archive/superseded.
3. Update this index in the same commit as any source-of-truth change.
4. Keep implementation tracker aligned with the latest product and engineering specs.
