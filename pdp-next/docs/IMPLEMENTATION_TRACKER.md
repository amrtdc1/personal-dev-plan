# Implementation Tracker

Status: Active
Last Updated: 2026-05-29 (Mobile Overhaul First)
Owner: Engineering

## Source of Truth Links
- Documentation index: 00_DOC_SYSTEM_INDEX.md
- Product strategy: 10_PRODUCT_STRATEGY_AND_DECISIONS.md
- Product spec: 20_PLANNING_REDESIGN_PRODUCT_SPEC.md
- Engineering blueprint: 21_PLANNING_REDESIGN_ENGINEERING_BLUEPRINT.md
- Mobile flattening spec: 22_MOBILE_SURFACE_FLATTENING_SPEC.md

## Current Phase
Mobile surface flattening overhaul (first), then planning redesign backend foundation.

## Now
1. Execute shared mobile flattening class/token pass in global styles.
2. Flatten workspace shell + Today + Planning mobile container depth.
3. Run mobile/desktop regression pass for hierarchy and theming.

## Next
1. Flatten Habits, Journal, and Calendar mobile surfaces.
2. Define and push planning entities in schema/perms.
3. Stand up owner-scoped planning cycle and commitment routes.

## Later
1. Build Planning Weekly Preview shell and daily focus persistence flows.
2. Add carryover and quarterly preview workflows.
3. Remove or refactor legacy planning code paths no longer aligned with new model.

## Completed in This Cleanup
- Archived legacy and superseded documentation.
- Established source-of-truth documentation index and precedence.
- Published active planning product spec and engineering blueprint.

## Notes
- This app is pre-production, so intentional destructive cleanup is allowed when it removes conflicting legacy patterns and reduces long-term complexity.
- Full IA changes are out of scope; this overhaul improves internal workspace hierarchy only.
