# Mobile Surface Flattening Spec

Status: Active
Last Updated: 2026-05-29
Owner: Product + Engineering

## Objective
Reduce visual clutter on mobile devices by flattening nested panel/card borders while preserving desktop scanability and existing information architecture.

## Problem
Current signed-in pages use multiple nested bordered containers. On small screens, this creates noisy, cramped UI with poor hierarchy readability.

## Scope
- Applies to signed-in workspace UI only.
- Applies to: Today, Planning, Habits, Journal, Calendar.
- Does not change top-level navigation or workspace IA.

## Design Principles
1. One strong container per section on mobile.
2. Use spacing and typography for hierarchy; not repeated border boxes.
3. Preserve richer depth cues on desktop.

## Surface Hierarchy Model
### Level 1: Section Surface
- Primary workspace container.
- Keeps border on mobile and desktop.

### Level 2: Group Surface
- Logical content clusters.
- Desktop: border allowed.
- Mobile: flattened to borderless surface.

### Level 3: Item Surface
- Rows/cards for individual items.
- Desktop: subtle card or divider style.
- Mobile: row/divider-first treatment, minimal box treatment.

## Mobile Rules (<= 768px)
1. At most one bordered parent visible at a time in viewport section.
2. Nested cards lose border and shadow unless interactive state requires emphasis.
3. Sectioning uses vertical spacing tokens and thin dividers.
4. Side rails convert to top controls, drawers, or sheets.
5. Multi-column lane layouts collapse into drill-in flow where appropriate.

## Desktop Rules (>= 1024px)
1. Preserve panel depth where it improves scan speed.
2. Keep existing multi-column structures when useful.
3. Keep semantic class hierarchy and tokenized styling.

## Component Targets
1. Workspace shell
- File: src/components/dashboard/workspace-shell.tsx
- Mobile: flatten left rail containers and reduce nested framing.

2. Today workspace
- File: src/components/dashboard/dashboard-insights.tsx
- Mobile: flatten queue and mode surfaces, reduce card-within-card layouts.

3. Planning workspace
- File: src/components/dashboard/migration-data-preview.tsx
- Mobile: flatten nested goal/task panels and favor drill-in transitions.

4. Habits workspace
- File: src/components/dashboard/habits-workspace.tsx
- Mobile: flatten metric and list containers.

5. Journal workspace
- File: src/components/dashboard/journal-workspace.tsx
- Mobile: flatten entry cards and filter wrappers.

6. Calendar workspace
- File: src/components/dashboard/calendar-workspace.tsx
- Mobile: flatten filter/control wrappers while keeping event readability.

## CSS and Token Contract
Primary style source:
- src/app/globals.css

Add viewport-aware semantic variants:
- pdp-panel-mobile-flat
- pdp-panel-muted-mobile-flat
- pdp-card-mobile-flat
- pdp-divider-list

Token behavior goals:
- Mobile: reduced radius, reduced shadow, reduced border density.
- Desktop: retain current semantic depth tokens.

## Acceptance Criteria
1. Mobile views no longer show repeated nested border boxes within the same section.
2. Desktop visual hierarchy remains clear and not visually regressed.
3. No IA changes are required to navigate existing workspaces.
4. All updated surfaces remain theme-consistent in light, dark, and system/CWM paths.

## Rollout Order
1. Shared CSS/token pass.
2. Workspace shell flattening.
3. Today workspace pass.
4. Planning workspace pass.
5. Habits/Journal/Calendar polish pass.

## Risks and Mitigation
Risk: over-flattening harms discoverability.
- Mitigation: retain clear section headers, spacing rhythm, and high-contrast primary actions.

Risk: inconsistent per-page styling.
- Mitigation: centralize mobile flattening in semantic classes and token rules before per-component edits.
