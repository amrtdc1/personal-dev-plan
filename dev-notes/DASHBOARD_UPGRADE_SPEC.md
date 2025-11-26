# PDP App — Dashboard Upgrade Specification

## Objective
Enhance the Dashboard view to provide meaningful, actionable insights when the user first logs in. The upgraded dashboard should show:
1. A richly populated **Current Focus** section.
2. A **Tasks Due Soon** panel.
3. An **At-Risk Items** panel.
4. A **Recently Updated** activity feed.
5. (Optional future) A weekly progress trend visual.

All new UI must support Light, Dark, and CWM themes, using existing CSS variables and theme blocks.

This spec should be used by VS Code Copilot to guide implementation.


---

## 1. Current Functionality (Baseline)
The Dashboard currently includes:
- Overview stats:
  - # of Professional goals
  - # of Personal goals
  - Overall completion percentage
- A placeholder "Current Focus" container with no data inside

All Firestore data is already available:
- Goals (with `isFocus`, `percentComplete`, projected dates, actual dates, subgoals)
- Sub-goals
- Tasks (with due dates)
- Timestamps (`createdAt`, `updatedAt`)

Copilot should use existing data-loading helper functions.
Focus goals can be identified via the `isFocus` field (boolean).


---

## 2. Feature Requirements

### 2.1 Current Focus Section Upgrade
Populate the “Current Focus” card with the following:

**Required:**
- Focus goal title (goal where `isFocus === true`)
- Percent complete
- Progress bar (reuse existing goal progress styling)
- Timeframe:
  - Projected start / end dates
  - Days remaining until projected end
- Summary counts:
  - Sub-goals completed vs total
  - Tasks completed vs total (through rollup)

**Quick actions (optional but recommended):**
- Add Sub-goal button
- Add Task button

If no focus goal exists:
- Display placeholder text:
  “No focus goal selected. Edit a goal and toggle ‘Set as Focus Goal’ to highlight it here.”

**Theme:**  
Must work seamlessly across Light, Dark, and CWM.


---

### 2.2 Tasks Due Soon Panel
Add a sidebar-like panel or card containing tasks sorted by urgency.

**Task filtering logic:**
- Overdue tasks: `dueDate < today` and status != "done"
- Due today
- Due within next 7 days
- Optional: No due date items ignored

**Data displayed per task:**
- Task title
- Parent Sub-goal
- Parent Goal
- Due date (formatted)
- Status pill or dropdown
- Small accent dot by urgency level (color-coded)

**Sort order:**
1. Overdue (oldest first)
2. Due today
3. Due within next 7 days

**Theme:**
Track background, segmented borders, and text colors must respect theme variables.

**Click behavior:**
Clicking an item opens the task’s modal in “edit” mode.


---

### 2.3 At-Risk Items Panel
Small panel identifying PDP items that need attention.

**Rules:**

**A. At-risk goals:**
- A goal whose `projectedStartDate < today` AND status = "not_started"
- A goal past `projectedEndDate` AND not done

**B. At-risk sub-goals:**
- Same logic as goals

**C. At-risk tasks:**
- Overdue tasks (may overlap with Tasks Due Soon panel)

**Display:**
- “X goals behind schedule”
- “Y sub-goals behind schedule”
- “Z overdue tasks”
- Simple icons or small badges to indicate type

**Click behavior:**
Clicking the panel opens filtered Goals view or scrolls the Goals page to the relevant section.


---

### 2.4 Recently Updated Panel
Add a reverse-chronological list of recent activity.

**Data source:**
- Use `updatedAt` on tasks, sub-goals, goals.
- If an item does not have `updatedAt`, default to its `createdAt`.

**Show the last 5 updates:**
Possible entries:
- “Task ‘X’ marked done”
- “Sub-goal ‘Y’ updated”
- “Goal ‘Z’ progress updated”
- “Added task ‘T’”
- “Changed due date for task ‘W’”

**UI expectations:**
- Timestamp displayed (e.g., “2 days ago”)
- Optional icons:
  - ✔ for tasks completed
  - 🔧 for updates
  - ➕ for added items

**Click behavior:**
Each entry opens the relevant modal (goal/sub-goal/task).

**Theme:**
Fully theme-aware.


---

### 2.5 (Optional Future) Weekly Progress Trend
Add a small visual showing overall progression over time.

**Data model (optional):**
New collection: `weeklySnapshots` if desired.

**UI:**
- Small sparkline chart or progress bar history
- Text like “+8% since last week”
- Positioned near Overview

**This feature should not be implemented unless explicitly requested.**


---

## 3. Implementation Guidelines

### 3.1 Affected Files
Copilot should update the following:

1. `index.html`
   - Add dashboard sections:
     - Current Focus content
     - Tasks Due Soon panel
     - At-Risk panel
     - Recently Updated panel
   - Ensure structure matches existing layout patterns.

2. `styles.css`
   - Add dashboard component classes:
     - `.dashboard-focus`
     - `.dashboard-tasks-soon`
     - `.dashboard-at-risk`
     - `.dashboard-recent-updates`
   - Theme-aware CSS using existing variables:
     - Light, Dark, CWM sections
   - Maintain modern style consistent with the rest of the app.

3. `main.js`
   - Add data loaders:
     - `loadTasksDueSoon()`
     - `loadAtRiskItems()`
     - `loadRecentUpdates()`
   - Add helper functions:
     - For date comparisons
     - For progress calculations (reuse existing)
   - Add UI rendering functions for the new dashboard components.
   - Wire dashboard refresh into the existing page load flow.

4. Firestore
   - No schema changes required.
   - Use existing fields:
     - `createdAt`, `updatedAt`, `dueDate`, `projectedStartDate`, `projectedEndDate`

### 3.2 Performance
- Avoid repeated Firestore reads.
- Use existing cached structures in memory (goals, subgoals, tasks).
- Only query Firestore once per dataset.


---

## 4. Acceptance Criteria

The Dashboard upgrade is complete when:

- Current Focus displays actual goal data or clearly states no focus goal.
- Tasks Due Soon shows correct tasks with accurate urgency grouping.
- At-Risk panel lists correct counts for goals/sub-goals/tasks.
- Recently Updated panel shows the last 5 changes across tasks/sub-goals/goals.
- All four new sections match app styling and theme-aware behavior across Light, Dark, and CWM modes.
- No blue artifacts remain inside the CWM theme.
- Navigation, modals, Goals view, and Calendar view remain fully functional.
