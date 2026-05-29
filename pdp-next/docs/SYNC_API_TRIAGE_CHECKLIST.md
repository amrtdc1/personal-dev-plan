# Sync and API Failure Triage Checklist

Status: Active Reference
Last Updated: 2026-05-29
Owner: Engineering

Use this checklist for fast diagnosis when offline sync or API requests fail.

## Where Signals Appear
- Browser console telemetry entries with prefix: `[telemetry]`
- Sync failure UI messages in Profile manual sync and offline status pill
- API route responses with categorized HTTP status

## Diagnostic Code Map
- `SYNC-NET`: network/connectivity/transient failure
- `SYNC-AUTH`: authentication or permissions failure
- `SYNC-SCHEMA`: schema mismatch or missing attributes
- `SYNC-CONFLICT`: stale/conflict replay condition
- `SYNC-RESTORE`: restore window expired
- `SYNC-STALE`: entity no longer present or changed on another client
- `SYNC-UNKNOWN`: uncategorized failure

## Triage Steps (5-minute pass)
1. Capture telemetry context
- Note `event`, `operation`, `diagnosticCode`, `status`, `route`, and timestamp.

2. Confirm user/session state
- Verify user is currently signed in.
- For `SYNC-AUTH`, sign out/in and retry.

3. Confirm connectivity
- For `SYNC-NET`, verify browser online status and retry manual sync.

4. Check conflict/stale indicators
- For `SYNC-CONFLICT` or `SYNC-STALE`, refresh app state and confirm the target entity still exists.
- Retry mutation after refresh to align with latest server snapshot.

5. Check schema alignment
- For `SYNC-SCHEMA`, validate deployed schema/perms state and re-run sync.

6. Escalate only with sanitized context
- Share diagnostic code and sanitized telemetry payload.
- Do not include raw secrets, tokens, or full user payloads.

## API Failure Quick Guide
- `400`: request/validation issue
- `401`: auth required or invalid session
- `404`: entity not found for owner scope
- `500`: unexpected server path; inspect `[telemetry] api_failure` entries

## Recovery Actions by Category
- `SYNC-NET`: wait for stable connection, click Retry now
- `SYNC-AUTH`: reauthenticate, retry
- `SYNC-SCHEMA`: confirm schema/perms deployment, retry
- `SYNC-CONFLICT` or `SYNC-STALE`: refresh, re-open the record, retry with latest state
- `SYNC-RESTORE`: no replay retry; restore window expired and operation must be re-planned
