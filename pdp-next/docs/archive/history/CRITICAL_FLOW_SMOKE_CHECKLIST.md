# Critical Flow Smoke Checklist (R2)

Date: 2026-05-23

Purpose: validate critical app flows before release-readiness closeout.

## Status Summary
- Automated checks: pass
- Manual authenticated checks: pass
- Overall R2 status: Complete

## Automated Smoke Evidence
| Check | Expected | Result | Evidence |
| --- | --- | --- | --- |
| App root responds | `200` from `/` | Pass | `STATUS=200` |
| Signed-out landing baseline marker | Landing content present | Pass | `HAS_PDP=True` |
| Manifest route responds | `200` from `/manifest.webmanifest` | Pass | `STATUS=200` + payload starts with `{"name":"Personal Development Plan"...}` |
| College teams API responds | `200` with team payload | Pass | `STATUS=200`, `TEAM_COUNT=265` |
| Profile API auth guard (unsigned) | `401` on unauthorized profile write | Pass | `STATUS=401` for `PUT /api/profile` |

## Manual Authenticated Checks (Pending)
Run these in browser while signed in:

1. Auth path
- Verify Magic Code sign-in succeeds.

Result: Pass (user confirmed)

2. Onboarding return path
- First login should route through onboarding.
- Returning login should route to Dashboard.

Result: Pass (user confirmed)

3. Profile save
- Update profile fields and save.
- Confirm success message and persistence after refresh.

Result: Pass (user confirmed)

4. Theme save
- Change display mode + theme source/palette/team and save.
- Confirm header branding and watermark persistence after refresh.

Result: Pass (user confirmed)

5. Manual sync
- Queue at least one offline change.
- Reconnect and use manual sync.
- Confirm expected success or actionable failure messaging.

Result: Pass (user confirmed)

## Defect Log Template
Use this format for any findings:

`Severity | Area | Steps | Expected | Actual | Owner | Status`

## Exit Criteria for R2
- All manual authenticated checks above pass.
- Any defects found are recorded with severity and owner.
- R2 can be moved to `Done` on the task board.

Exit status: Met
