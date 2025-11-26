# Personal Development Plan (PDP) Web App – Master Spec

## 1. Overview

This project is a Personal Development Plan web application built with:
- Vanilla HTML, CSS, JavaScript
- Firebase Authentication
- Firebase Firestore
- Theming system with:
  - Light theme
  - Dark theme
  - CWM theme (company-branded, with specific colors and background logo)

The app is already functional and deployed via GitHub Pages. This spec describes how the app should evolve over time, so future changes should align with this document.

The main conceptual model:
- Goals
- Sub-goals (belong to a Goal)
- Tasks (belong to a Sub-goal)

All data is user-specific (multi-user, using Firebase Auth).


## 2. Current State (Baseline Context for Copilot)

The app currently supports:

### Data Model (Firestore)
- `goals` collection
  - Fields (key ones): `ownerUid`, `type` ("professional" | "personal"), `title`, `description`, `timeframe`, `status`, `percentComplete`, `projectedStartDate`, `projectedEndDate`, `actualStartDate`, `actualEndDate`, `archived`, `isFocus`, `themeColor`, `orderIndex`, `createdAt`, etc.
- `subgoals` collection
  - Fields include: `ownerUid`, `goalId`, `title`, `description`, `timeframe`, `status`, `percentComplete`, `projectedStartDate`, `projectedEndDate`, `actualStartDate`, `actualEndDate`, `archived`, `orderIndex`, etc.
- `tasks` collection
  - Fields include: `ownerUid`, `subgoalId`, `title`, `notes`, `dueDate`, `status`, `percentComplete`, `archived`, `orderIndex`, etc.

### Core Functionality
- Users sign in/sign out with Firebase Authentication.
- Per-user data is loaded from Firestore (multi-user safe).
- Goals:
  - Create / Read / Update / Delete (via modals).
  - Ordered with `orderIndex` + drag-and-drop reordering.
- Sub-goals:
  - Created within a Goal (via modals).
  - CRU(D) operations.
  - Ordered with `orderIndex` + drag-and-drop.
- Tasks:
  - Created within a Sub-goal (via modals).
  - CRU(D) operations.
  - Ordered with `orderIndex` + drag-and-drop.

### Progress / Status
- Task status: Not started / In progress / Done.
- Sub-goal progress is calculated from child Tasks (average of their %).
- Goal progress is calculated from child Sub-goals (average of their %).
- Dashboard includes an overall progress bar + high-level stats.

### UI / UX
- Views: Dashboard + Goals (and nav structure ready for additional views).
- Nested layout:
  - Goals as cards.
  - Sub-goals inside each Goal card.
  - Tasks inside each Sub-goal.
- Collapsible sections for nested content (roll-up / drill-down).
- Drag-and-drop:
  - Reorder Goals in each column.
  - Reorder Sub-goals within a Goal.
  - Reorder Tasks within a Sub-goal.

### Theming
- Light theme: modern, colorful gradients, clean cards.
- Dark theme: darker gradients, high contrast, readable.
- CWM theme:
  - Uses brand colors:
    - Primary: `#1e4741`
    - Secondary: `#ffd400`
    - Dark background: `#2d2c25`
    - Other: `#e5e1d6`, `#182c28`
  - Background includes CWM logo (`assets/cwm-logo.png`) plus radial gradients.
  - Many UI elements are overridden so they are on-brand (no blue-ish leftovers).
- Theme toggle cycles: Light → Dark → CWM → Light.
- Theme toggle icon:
  - Light: sun
  - Dark: moon
  - CWM: `assets/cwm-logo-icon.ico` as an inline `<img>`.

### Modals
- Add / Edit Goal.
- Add / Edit Sub-goal.
- Add / Edit Task.
- Modals are now fully themed:
  - Use theme-aware CSS variables for modal background, borders, labels, and fields.
  - Legible and on-brand in all three themes.

### CSS State
- `styles.css` is the single stylesheet.
- It already includes:
  - Global theme variables in `:root`, `body[data-theme="dark"]`, `body[data-theme="cwm"]`.
  - Modern card styles, nested elements, pills, badges, progress bars, nav buttons.
  - CWM-specific overrides so that all UI controls (nav, buttons, pills, progress bars, etc.) align with brand colors.



## 3. Guiding Principles for Future Enhancements

Copilot should follow these principles when implementing new features:

1. **Preserve the theming system**  
   - All new UI should respect `data-theme` (`light`, `dark`, `cwm`) and use CSS variables rather than hard-coded colors.

2. **Keep Firestore data per-user and scoped**  
   - Every new collection or document type must store `ownerUid` and be queried by that.

3. **Avoid breaking existing flows**  
   - Existing CRUD operations for goals, sub-goals, tasks must continue to function as-is.
   - Drag-and-drop ordering should remain intact.

4. **Progress roll-up must remain consistent**  
   - When adding new ways to adjust status/progress, keep the roll-up logic for:
     - Tasks → Sub-goals
     - Sub-goals → Goals
     - Goals → Dashboard

5. **UI consistency**  
   - New components (buttons, cards, modals, tabs, etc.) should reuse existing classes and patterns where possible.
   - Navigation and layout should remain simple and mobile-friendly (responsive).



## 4. Roadmap of Desired Features

The following features are desired for future iterations. Copilot should treat this as a backlog and help implement them one by one as requested.

### 4.1 Calendar / Timeline View

New view: **Calendar**.

- Add a new tab in the top navigation next to Dashboard and Goals:
  - e.g., `<button class="nav-btn" data-section="calendar">Calendar</button>`.
- Add a new main section/container:
  - `<section id="calendarView" class="view hidden"></section>`.

Requirements:
- Default: Month view (simple calendar grid).
- Show:
  - Goals as timeline bars from `projectedStartDate` to `projectedEndDate`.
  - Sub-goals similarly, connected to their parent goal.
  - Tasks as markers/dots on their `dueDate`.
- Theme-aware:
  - Light/Dark/CWM each get visually coherent calendar colors.
- Interaction:
  - Clicking a goal/sub-goal/task on the calendar should open the corresponding edit modal (reuse existing modals).
- Layout:
  - Keep it simple and legible.
  - No need for full-featured drag-resize yet.
- Future-friendly:
  - Structure the code so that later we can support drag to adjust dates (Gantt-like behavior).



### 4.2 Reminders & Notifications (Future, Not Immediate)

Use Firebase Cloud Messaging (FCM) and/or simple in-app notifications for:

- “Task due today” reminders.
- “Sub-goal ending this week.”
- “Focus goal hasn’t been updated in N days.”

Implementation guidelines:
- Use Firestore fields (`dueDate`, `projectedEndDate`, etc.).
- Prefer a non-intrusive UI (toasts, small banner, or notifications center in Dashboard).
- If FCM/browser push is implemented:
  - Ask for notification permission in a user-friendly way.
  - Use a service worker to handle FCM messages.



### 4.3 Insights / Analytics Panel

Add a richer analytics section on the Dashboard, such as:

- Distribution of goals by status (Not started / In progress / Done).
- Average task completion rate per sub-goal or per goal.
- On-track vs off-track items based on dates.
- Possibly simple charts (if using a chart library is allowed) or at least summarized stats.

Guidelines:
- Use existing Firestore data; no schema changes required initially.
- Keep it visually simple and theme-aware.
- Don’t add heavy dependencies unless necessary.



### 4.4 Mentorship & Notes Section

Add support for:
- A “Mentorship” or “Notes” area that allows the user to log:
  - Conversations with mentors (e.g., VP).
  - Insights, decisions, follow-ups.
  - Reflections tied to specific goals or sub-goals.

Data model (suggested):
- New collection: `notes` or `mentorshipEntries`
  - `ownerUid`
  - `relatedGoalId` (optional)
  - `relatedSubgoalId` (optional)
  - `title`
  - `body` (text, possibly markdown-style)
  - `createdAt`
  - `updatedAt`
- UI:
  - New nav item (e.g., “Mentorship” or “Journal”).
  - List + details view.
  - Modal for adding/editing entries.
- Theme:
  - Match existing cards/modals and respect Light/Dark/CWM.



### 4.5 Attachments (Optional Enhancement)

Ability to attach files (PDF, images, documents) to goals, sub-goals, or tasks.

Suggested implementation:
- Firebase Storage for files.
- Firestore references on:
  - `goals` / `subgoals` / `tasks` to list attachments:
    - e.g. `attachments: [{ name, url, contentType, createdAt }]`.
- Simple UI:
  - “Attachments” section inside a Goal/Sub-goal/Task modal.
  - Upload, list, delete.

This is a non-trivial feature; should be implemented only when explicitly requested.



### 4.6 Sharing & Export (Future)

Export options:
- Generate a “PDP Summary” view that:
  - Summarizes Goals, Sub-goals, Tasks, progress.
  - Includes key dates and notes.
- Optionally support:
  - Printing via a print-optimized CSS layout.
  - Export to PDF (browser print-to-PDF is acceptable).
  - Future: Export as JSON or simple CSVs for backup.



## 5. How Copilot Should Behave

When I (the developer) ask Copilot to implement a specific feature, it should:

1. Use this spec as the high-level guide.
2. Touch only the files required (usually `index.html`, `main.js`, `styles.css`).
3. Preserve:
   - Existing auth & Firestore logic.
   - Existing themes, especially CWM.
   - Existing drag-and-drop and modals.
4. Keep code modular and readable:
   - Break large functions into smaller helpers when necessary.
   - Avoid duplicating logic that already exists (reuse status computation, theming utils, etc.).
5. Only introduce new dependencies if really needed and consistent with a lightweight front-end app.


## 6. Initial Priority

When starting from this spec, the first major feature to implement is:

**Calendar / Timeline View (Section 4.1)**

Follow that section first when I ask for “Calendar” features.

After Calendar is stable, we can move on to:

- Reminders / Notifications
- Insights
- Mentorship notes
- Attachments
- Export

in that general order, but always driven by explicit requests in Copilot Chat.
