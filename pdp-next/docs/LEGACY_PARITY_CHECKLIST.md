# Legacy Parity Checklist (from main.js)

## Scope
This checklist maps behavior in the legacy app (`main.js`) into concrete parity targets for the Next.js migration workspace.

## Status Legend
- Done: implemented and validated in `pdp-next`
- In Progress: partial implementation exists
- Not Started: no equivalent slice implemented yet

## Parity Matrix
| Area | Legacy Behavior (main.js evidence) | Next Target | Status | Notes |
| --- | --- | --- | --- | --- |
| Authentication | Google + Email auth, signup/signin, forgot password, profile update, password change, delete account (`setupAuthUI`) | InstantDB Magic Code baseline, then add secondary provider and account management parity | In Progress | Magic Code completed; Google/account workflows deferred |
| User profile bootstrap | User profile defaults persisted and reused (`getUserDoc`, profile load/update in auth and account flows) | Bootstrap + persistent profile in repository | Done | Implemented via Magic Code sign-in bootstrap |
| Goals read/write | CRUD modal flows, status updates, order persistence (`openGoalModal`, `saveGoalStatus`, `persistGoalOrder`) | Repository-backed goal CRUD and status/order parity | Done | Protected API routes now cover CRUD/status/reorder flows with shared validation and ownership checks |
| Subgoals read/write | Modal CRUD, status updates, order persistence (`openSubgoalModal`, `saveSubgoalDoc`, `saveSubgoalStatus`, `persistSubgoalOrder`) | Repository-backed subgoal CRUD and status/order parity | Done | Protected API routes now cover CRUD/status/reorder flows with shared validation and ownership checks |
| Tasks read/write | Modal CRUD, status updates, due dates, order persistence (`openTaskModal`, `saveTaskDoc`, `saveTaskStatus`, `persistTaskOrder`) | Repository-backed task CRUD and status/order parity | Done | Protected API routes now cover CRUD/status/reorder flows with shared validation and ownership checks |
| Archiving and restore | Soft-archive toggles for goals/subgoals/tasks/journal (`archive*`, `unarchive*`) | 60-day soft-delete lifecycle primitives with restore and purge | Done | Archive/restore routes and owner-scoped purge are implemented with restore-window enforcement |
| Permanent delete cascades | Cascading deletes (`deleteGoalWithChildren`, `deleteSubgoalWithTasks`, `deleteTask`) | Safe destructive workflows with ownership checks + confirm UX | Not Started | Security checklist dependency |
| Progress rollups | Task -> subgoal -> goal percent rollups (`computeSubgoalPercent`, `computeGoalPercent`, `updateStats`) | Shared domain rollup service and dashboard parity | In Progress | Domain types exist; full parity rendering pending |
| Dashboard insights | Current focus, tasks due soon, at-risk, recently updated (`renderCurrentFocus`, `renderTasksDueSoon`, `renderAtRiskItems`, `renderRecentlyUpdated`) | Equivalent dashboard cards in app route | Done | Repository-backed `DashboardInsights` cards now render in the app route |
| Calendar timeline | Goal/subgoal bars + task dots, month navigation (`renderCalendar`, `buildCalendarEvents`, `setupCalendarUI`) | Calendar view parity with timeline bars and due markers | In Progress | `CalendarWorkspace` is implemented with event rendering and themed controls; parity polish is still open |
| Journal | Journal CRUD, markdown preview, tags, mood and goal filters (`openJournalModal`, `renderJournalEntries`) | Repository-backed journal module with filtering | Done | `JournalWorkspace` now supports create/edit/archive/restore with mood/tag/goal filters |
| Theme + palette | Theme cycle (light/dark/cwm), palette picker, persisted settings (`setTheme`, `setupThemeToggle`, `applyPalette`) | Preserve existing theme/palette behavior before college themes | Done | Quick display-mode toggles, palette/CWM/college source selection, and persisted logo branding are now aligned |
| Navigation persistence | Persist active section and UI state (`setupNav`, localStorage keys) | Route/section persistence equivalent | Done | App now intentionally lands returning users on Dashboard; onboarding still gates first-login users |
| Drag-and-drop ordering | DnD for goals/subgoals/tasks (`attach*DragHandlers`, `persist*Order`) | Ordered list interactions + orderIndex persistence | Not Started | Can follow status parity for each entity |
| Offline support | Legacy is online-first | Installable PWA + queued offline writes + reconnect replay | In Progress | Client-side queue + sync status UX shipped for save flows; status/reorder/archive queueing remains |
| ICS export/subscription | Not present in legacy implementation | New migration requirement: ICS export + tokenized feed | Not Started | Migration enhancement requirement |

## Recommended Build Order (post-current slice)
1. Permanent delete cascade workflows with ownership and confirm safeguards
2. Drag-and-drop ordering UX parity on goals/subgoals/tasks lists
3. Calendar parity polish (timeline behavior and interaction parity vs legacy)
4. Offline queue coverage expansion (status/reorder/archive) + reconnect replay QA
5. ICS export + tokenized subscription feed
