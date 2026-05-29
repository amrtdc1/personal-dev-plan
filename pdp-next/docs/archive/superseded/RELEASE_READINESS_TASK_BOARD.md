# Release Readiness Task Board

This board is the source of truth for final readiness work before new initiatives.

## How To Use
- Keep statuses updated after each work session.
- Move completed items to `Done` and record the completion date.
- If blocked, add a short blocker note in `Notes`.
- At session start, resume from the highest-priority `Now` item.

## Status Legend
- `Todo`: Not started
- `In Progress`: Active work
- `Blocked`: Waiting on decision/dependency
- `Done`: Completed and validated

## Definition of Ready
- No blocker or high-severity open defects.
- Critical flows are verified end-to-end.
- Offline sync queue/replay behavior is hardened and validated.
- Observability and security closure items are complete.
- `npm run test`, `npm run lint`, and `npm run build` pass on `main`.
- Release candidate checkpoint and rollback plan are documented.

## Now
| ID | Task | Status | Owner | Notes |
| --- | --- | --- | --- | --- |


## Next
| ID | Task | Status | Owner | Notes |
| --- | --- | --- | --- | --- |

## Later
| ID | Task | Status | Owner | Notes |
| --- | --- | --- | --- | --- |


## Done
| ID | Task | Completed On | Notes |
| --- | --- | --- | --- |
| R11 | Final staging smoke, release candidate checkpoint, and rollback plan | 2026-05-24 | Lint/test/build passed on `main`; checkpoint + rollback documented in `docs/RELEASE_CANDIDATE_CHECKPOINT_AND_ROLLBACK_PLAN.md` |
| R10 | Verify soft-delete retention, restore-window, and purge behavior end-to-end | 2026-05-24 | User confirmed staging lifecycle validation complete; see `docs/SOFT_DELETE_LIFECYCLE_VERIFICATION.md` |
| D1 | Extend offline queue operation coverage and replay metadata plumbing | 2026-05-23 | Added queued status/reorder/archive/restore replay support and failure metadata |
| D2 | Surface sync failures in UI with retry action | 2026-05-23 | Added shared sync failure state and offline status diagnostics |
| D3 | Add sync failure state unit tests and friendly failure copy mapping | 2026-05-23 | Added `sync-status` tests and user-friendly reason mapping |
| D4 | Stabilize local runtime startup and restart workflow (R1) | 2026-05-23 | Root cause confirmed as duplicate `next dev` process on port 3000; validated 3 clean start/stop/restart cycles on port 3000; see `docs/DEV_RUNTIME_STARTUP_RUNBOOK.md` |
| D5 | Critical flow smoke pass (R2) | 2026-05-23 | Automated checks passed and user-confirmed manual authenticated checks passed; see `docs/CRITICAL_FLOW_SMOKE_CHECKLIST.md` |
| D6 | Branding validation by theme source (R3) | 2026-05-23 | User confirmed palette/CWM/college branding behavior and persistence are correct and independent of display mode |
| D7 | Offline replay retry/backoff hardening (R4) | 2026-05-23 | Added transient-error retry/backoff in `write-queue` with dedicated tests; test/lint/build all green |
| D8 | Conflict handling for stale/offline mutations (R5) | 2026-05-23 | Added offline replay conflict classification with user-facing guidance and conflict-path tests; test/lint/build all green |
| D9 | Offline transition/replay automated coverage expansion (R6) | 2026-05-23 | Added offline->online and ordered multi-replay integration tests in `repository.test`; test/lint/build all green |
| D10 | Friendly sync failure mapping and diagnostics consistency (R7) | 2026-05-23 | Centralized failure classification/reason/code helpers and applied consistent messaging across status pill and manual sync surface; test/lint/build all green |
| D11 | Structured sync/API observability and triage checklist (R8) | 2026-05-23 | Added sanitized telemetry for sync replay + API failures and documented operator runbook in `docs/SYNC_API_TRIAGE_CHECKLIST.md` |
| D12 | Security and permission closure pass (R9) | 2026-05-23 | Added API route auth-contract regression test, finalized CSP + permissions headers, and updated baseline security checklist statuses; test/lint/build all green |

## Session Handoff Template
Copy this block at the end of each session:

`Last Completed:`

`Current In Progress:`

`Blockers:`

`Next Task:`
