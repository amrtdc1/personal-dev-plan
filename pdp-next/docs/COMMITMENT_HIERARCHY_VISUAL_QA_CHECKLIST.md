# Commitment Hierarchy Visual QA Checklist

Status: Active Reference
Last Updated: 2026-05-29
Owner: Engineering

Use this checklist to verify Goals -> Commitments -> Tasks hierarchy is visually consistent across major dashboard surfaces.

## Scope
- Planning panel
- Today workspace
- Calendar workspace
- Node Map workspace

## Preconditions
1. App starts cleanly using current branch data.
2. At least one weekly cycle and one quarterly cycle exist.
3. Fixture data includes:
- one task linked to a commitment and goal
- one task linked to a commitment only
- one task with no commitment

## Checklist: Planning Panel
1. Open Planning panel and confirm each commitment card shows:
- rank and title
- linked goal badge (when linked)
- linked task count
2. In quarterly mode, verify rollup chips render:
- total, done, in progress, not started, dropped, linked tasks
3. In carryover section, confirm:
- source cycle text is visible when prior cycle exists
- only non-done commitments appear as candidates
- carry-forward action button state transitions to loading and back

## Checklist: Today Workspace
1. Confirm commitment filter control is visible in Quick task actions.
2. Switch filter to All commitments, No commitment, and one specific commitment.
3. For each filter, verify:
- quick task queue updates to matching tasks only
- completed-today list respects same filter
- task cards still show due label and action buttons

## Checklist: Calendar Workspace
1. Open filter panel and confirm Commitment filter is present.
2. Switch among All commitments, No commitment, and one specific commitment.
3. Verify changes apply to both:
- calendar event task entries
- Today's agenda task entries
4. Create and edit a task from calendar modals and confirm hierarchy bits (goal/child/commitment) remain accurate in preview and agenda.

## Checklist: Node Map Workspace
1. Confirm task nodes include commitment context in subtitle when linked.
2. Confirm freestanding task list shows Commitment: <title> when linked.
3. Verify unlinked tasks do not show stale or placeholder commitment text.

## Visual Consistency Pass
1. Badge and label wording uses the same hierarchy language across surfaces.
2. No clipped or overlapping chips in mobile-width viewport.
3. Color contrast remains readable in both light and dark theme modes.

## Sign-Off Template
- Date:
- Tester:
- Build/branch:
- Result: Pass | Pass with notes | Fail
- Notes:
