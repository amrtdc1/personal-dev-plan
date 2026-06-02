# Commitment Hierarchy Manual Execution Script (2026-05-29)

Status: Active Run Script
Last Updated: 2026-05-29
Owner: Engineering

Use this script to complete remaining manual visual validation for Planning Preview Panel and Calendar Workspace.

## Setup
1. Start runtime from `pdp-next`:
- `npm.cmd run dev`
2. Open `http://localhost:3000` and sign in.
3. Ensure data has at least:
- one weekly commitment linked to a goal
- one quarterly commitment
- one task linked to commitment + goal
- one task with no commitment

## Planning Preview Panel Script

### Step P1: Weekly commitments hierarchy
1. Navigate to planning surface (weekly).
2. Confirm each visible commitment card shows:
- rank prefix (`#1`, `#2`, `#3`)
- commitment title
- linked goal badge when linked
- linked task count text/chip
3. Record result: Pass or Fail.

### Step P2: Carryover candidates rendering
1. Find carryover section for previous cycle.
2. Confirm source cycle date text is present when prior cycle exists.
3. Confirm only non-done commitments are listed.
4. Click one `Carry forward` button once.
5. Confirm button transitions to loading state (`Carrying...`) and returns.
6. Record result: Pass or Fail.

### Step P3: Quarterly rollup chips
1. Switch planning surface to quarterly.
2. Confirm rollup chips render for:
- total
- done
- in progress
- not started
- dropped
- linked tasks
3. Confirm average confidence line is visible.
4. Record result: Pass or Fail.

## Calendar Workspace Script

### Step C1: Commitment filter presence and options
1. Open Calendar workspace.
2. Open filter panel.
3. Confirm `Commitment filter` select exists.
4. Confirm options include:
- `All commitments`
- `No commitment`
- at least one concrete commitment option
5. Record result: Pass or Fail.

### Step C2: Filter behavior in calendar + agenda
1. Set filter to `All commitments`; note baseline task events count and Today's agenda task rows.
2. Set filter to `No commitment`; verify only uncommitted tasks remain.
3. Set filter to one concrete commitment; verify only tasks linked to that commitment remain.
4. Confirm both the calendar event list and Today's agenda respond consistently.
5. Record result: Pass or Fail.

### Step C3: Create/edit task hierarchy bits
1. Create a task from calendar with:
- parent goal/child goal selected
- commitment selected
2. Open event preview and verify hierarchy includes goal/child/commitment bits.
3. Edit same task to remove commitment.
4. Re-open preview and verify commitment bit is removed while goal/child remains.
5. Record result: Pass or Fail.

## Visual Consistency Script (Planning + Calendar)

### Step V1: Language consistency
1. Compare hierarchy labels across Planning and Calendar.
2. Confirm wording is consistent (`Goal`, `Child goal`, `Commitment`).
3. Record result: Pass or Fail.

### Step V2: Mobile clipping/overlap
1. Set viewport to narrow mobile width (~390px).
2. Re-check Planning chips and Calendar filter controls.
3. Confirm no clipping, overlap, or unreadable truncation.
4. Record result: Pass or Fail.

### Step V3: Theme contrast
1. Validate same screens in light and dark themes (if available in app settings).
2. Confirm labels/chips remain readable and contrast is acceptable.
3. Record result: Pass or Fail.

## Output Template
- Date:
- Tester:
- Branch:
- P1:
- P2:
- P3:
- C1:
- C2:
- C3:
- V1:
- V2:
- V3:
- Blocking issues:
- Non-blocking issues:
- Final verdict: Pass | Pass with notes | Fail
