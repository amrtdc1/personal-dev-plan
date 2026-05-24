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
| R1 | Stabilize local runtime startup and restart workflow | Todo | TBD | Confirm repeatable dev start/stop/restart and document recovery steps |
| R2 | Run critical flow smoke pass (auth, onboarding return path, profile save, theme save, manual sync) | Todo | TBD | Record defects with severity and owner |
| R3 | Validate branding behavior by theme source (palette, CWM, college) independent of display mode | Todo | TBD | Verify header logo and watermark behavior |

## Next
| ID | Task | Status | Owner | Notes |
| --- | --- | --- | --- | --- |
| R4 | Harden offline replay with retry/backoff for transient errors | Todo | TBD | Keep behavior idempotent and safe for repeated attempts |
| R5 | Define and implement conflict handling for stale/offline mutations | Todo | TBD | Include user-facing guidance when server state changed |
| R6 | Expand automated tests for offline-to-online transitions and replay outcomes | In Progress | Copilot + User | `sync-status` coverage added; transition/integration coverage pending |
| R7 | Add friendly sync failure mapping and operator diagnostics consistency | In Progress | Copilot + User | Friendly mapping shipped in status pill; validate across additional surfaces |

## Later
| ID | Task | Status | Owner | Notes |
| --- | --- | --- | --- | --- |
| R8 | Add structured observability for sync/API failures with sanitized operation context | Todo | TBD | Include quick triage checklist |
| R9 | Perform final security and permission closure pass across protected routes | Todo | TBD | Validate authz, validation, and env safety |
| R10 | Verify soft-delete retention, restore-window, and purge behavior end-to-end | Todo | TBD | Confirm expected lifecycle in staging |
| R11 | Final staging smoke, release candidate checkpoint, and rollback plan | Todo | TBD | Required before launch declaration |

## Done
| ID | Task | Completed On | Notes |
| --- | --- | --- | --- |
| D1 | Extend offline queue operation coverage and replay metadata plumbing | 2026-05-23 | Added queued status/reorder/archive/restore replay support and failure metadata |
| D2 | Surface sync failures in UI with retry action | 2026-05-23 | Added shared sync failure state and offline status diagnostics |
| D3 | Add sync failure state unit tests and friendly failure copy mapping | 2026-05-23 | Added `sync-status` tests and user-friendly reason mapping |

## Session Handoff Template
Copy this block at the end of each session:

`Last Completed:`

`Current In Progress:`

`Blockers:`

`Next Task:`
