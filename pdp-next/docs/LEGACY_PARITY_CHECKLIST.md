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
| Goals read/write | CRUD modal flows, status updates, order persistence (`openGoalModal`, `saveGoalStatus`, `persistGoalOrder`) | Repository-backed goal CRUD and status/order parity | In Progress | Create/update and reads done; status/order parity still pending |
| Subgoals read/write | Modal CRUD, status updates, order persistence (`openSubgoalModal`, `saveSubgoalDoc`, `saveSubgoalStatus`, `persistSubgoalOrder`) | Repository-backed subgoal CRUD and status/order parity | In Progress | Reads + create/update done; status/order parity still pending |
| Tasks read/write | Modal CRUD, status updates, due dates, order persistence (`openTaskModal`, `saveTaskDoc`, `saveTaskStatus`, `persistTaskOrder`) | Repository-backed task CRUD and status/order parity | In Progress | Reads + create/update done; status/order parity still pending |
| Archiving and restore | Soft-archive toggles for goals/subgoals/tasks/journal (`archive*`, `unarchive*`) | 60-day soft-delete lifecycle primitives with restore and purge | Not Started | Core parity gate requirement |
| Permanent delete cascades | Cascading deletes (`deleteGoalWithChildren`, `deleteSubgoalWithTasks`, `deleteTask`) | Safe destructive workflows with ownership checks + confirm UX | Not Started | Security checklist dependency |
| Progress rollups | Task -> subgoal -> goal percent rollups (`computeSubgoalPercent`, `computeGoalPercent`, `updateStats`) | Shared domain rollup service and dashboard parity | In Progress | Domain types exist; full parity rendering pending |
| Dashboard insights | Current focus, tasks due soon, at-risk, recently updated (`renderCurrentFocus`, `renderTasksDueSoon`, `renderAtRiskItems`, `renderRecentlyUpdated`) | Equivalent dashboard cards in app route | Done | Repository-backed `DashboardInsights` cards now render in the app route |
| Calendar timeline | Goal/subgoal bars + task dots, month navigation (`renderCalendar`, `buildCalendarEvents`, `setupCalendarUI`) | Calendar view parity with timeline bars and due markers | Not Started | Required by parity baseline |
| Journal | Journal CRUD, markdown preview, tags, mood and goal filters (`openJournalModal`, `renderJournalEntries`) | Repository-backed journal module with filtering | Done | `JournalWorkspace` now supports create/edit/archive/restore with mood/tag/goal filters |
| Theme + palette | Theme cycle (light/dark/cwm), palette picker, persisted settings (`setTheme`, `setupThemeToggle`, `applyPalette`) | Preserve existing theme/palette behavior before college themes | Not Started | College themes explicitly post-parity |
| Navigation persistence | Persist active section and UI state (`setupNav`, localStorage keys) | Route/section persistence equivalent | Not Started | Minor but user-visible parity item |
| Drag-and-drop ordering | DnD for goals/subgoals/tasks (`attach*DragHandlers`, `persist*Order`) | Ordered list interactions + orderIndex persistence | Not Started | Can follow status parity for each entity |
| Offline support | Legacy is online-first | Installable PWA + queued offline writes + reconnect replay | Not Started | Explicit phase gate |
| ICS export/subscription | Not present in legacy implementation | New migration requirement: ICS export + tokenized feed | Not Started | Migration enhancement requirement |

## Recommended Build Order (post-current slice)
1. Soft-delete lifecycle primitives (including ownership checks on destructive actions)
2. Status update parity for goals/subgoals/tasks
3. Order persistence parity for goals/subgoals/tasks
4. Dashboard parity cards (focus, due soon, at-risk, recent activity)
5. Journal CRUD + filtering parity
6. Calendar parity implementation
7. Offline queue + sync UX
8. ICS export + tokenized subscription feed
