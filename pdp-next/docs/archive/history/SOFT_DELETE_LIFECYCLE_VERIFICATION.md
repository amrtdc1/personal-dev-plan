# Soft-Delete Lifecycle Verification (R10)

Date: 2026-05-23

Purpose: verify retention window, restore-window enforcement, and purge behavior for goals/subgoals/tasks/journal.

## Automated Verification Evidence

### Repository lifecycle behavior
- File: `src/lib/data/repository.test.ts`
- Verified:
  - soft delete sets `deletedAt`, `restoreUntil`, and `purgeAt`
  - restore clears lifecycle fields when in-window
  - restore is blocked when restore window is expired (goal/subgoal/task)
  - purge deletes expired entities and cascades through descendants

### Server purge route contract
- File: `src/app/api/purge/route.test.ts`
- Verified:
  - authenticated `POST /api/purge` returns summary payload
  - route delegates failures through shared error response contract

### Offline replay behavior for expired restore windows
- File: `src/lib/data/repository.test.ts`
- Verified:
  - replay conflict/error messaging captures expired restore-window conditions

## Lifecycle Expectations Confirmed
1. Retention window is derived from configured `SOFT_DELETE_RETENTION_DAYS`.
2. Restore is allowed only before `restoreUntil` expires.
3. Purge removes only expired entities and cascades dependents correctly.

## Staging Signoff Checklist (Manual)
Run once on staging before release candidate signoff:

1. Archive a goal with descendants and record timestamps. ✅ Confirmed (2026-05-24)
2. Restore in-window and verify descendants restore correctly. ✅ Confirmed (2026-05-24)
3. Attempt restore after forced expiry test fixture and confirm rejection message. ✅ Confirmed (2026-05-24)
4. Trigger purge endpoint and confirm only expired records are removed. ✅ Confirmed (2026-05-24)
5. Verify purge summary counts align with expected deleted entities. ✅ Confirmed (2026-05-24)

## Status
- Automated/local verification: Complete
- Staging manual signoff: Complete

## Latest Manual Re-Verification
- 2026-05-24: Archive and restore flows reconfirmed working in Goals Workspace after ownership/lookup fixes.
- Cascade behavior remains validated for descendants (subgoals and tasks) on both archive and restore.
- 2026-05-24: Forced-expiry restore rejection validated with message: "Goal can no longer be restored because the restore window has expired".
- 2026-05-24: Purge endpoint behavior and purge summary counts validated (manual checklist steps 4-5 complete).
