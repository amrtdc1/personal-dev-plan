# Release Candidate Checkpoint and Rollback Plan

Date: 2026-05-24

## Objective
Create a final release checkpoint with verification evidence and a clear rollback path for `main`.

## Verification Evidence
The following commands were executed on `main` and passed:

- `npm.cmd run lint`
- `npm.cmd test`
- `npm.cmd run build`

Observed outcomes:
- Lint: no errors.
- Tests: 18 files, 89 tests passed.
- Build: Next.js production build succeeded; API routes generated including goals/subgoals/tasks/journal/calendar/notifications/profile/purge paths.

## Critical Flow Smoke Coverage
Critical auth/data flow smoke verification reference:
- `docs/CRITICAL_FLOW_SMOKE_CHECKLIST.md`

Soft-delete lifecycle verification reference:
- `docs/SOFT_DELETE_LIFECYCLE_VERIFICATION.md`

## Release Candidate Checkpoint
Recommended release checkpoint commit on `main`:
- Commit: `c635c69`
- Summary: checkpoint of calendar feed, notifications foundations, and journal protected API alignment.

## Rollback Plan
If a production issue is detected after release:

1. Identify target rollback commit:
   - Preferred: most recent known-good commit before release checkpoint.
   - Verify with `git log --oneline --decorate -n 20`.

2. Revert the release commit(s) on `main` (non-destructive history):
   - `git revert <commit-sha>`
   - For multiple commits: revert newest to oldest, one by one.

3. Push rollback commit(s):
   - `git push origin main`

4. Verify rollback integrity:
   - `npm.cmd run lint`
   - `npm.cmd test`
   - `npm.cmd run build`

5. Perform targeted smoke checks:
   - sign-in/session continuity
   - goals/subgoals/tasks CRUD and reorder
   - archive/restore + permanent delete guard behavior
   - journal CRUD/archive/restore/delete
   - calendar feed token issue/rotation and tokenized feed
   - notifications preference read/write and test send endpoint

6. Communicate rollback completion with:
   - rolled-back commit SHA(s)
   - rollback commit SHA
   - validation command results
   - remaining follow-up actions

## Fast Mitigation Option
If a full rollback is not required, apply a scoped hotfix commit on `main` for the affected route/component and rerun lint/test/build before pushing.

## Decision Log
- This release checkpoint is considered Ready based on passing lint/test/build and previously completed readiness tasks (D1-D12, R10), with R11 closure documented here.
