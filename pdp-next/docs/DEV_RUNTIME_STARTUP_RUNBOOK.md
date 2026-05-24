# Dev Runtime Startup Runbook

Use this runbook to keep local `next dev` startup stable and fast to recover.

## Confirm Current Runtime State
Run from any terminal:

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, Path
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess
```

If `3000` is listening, note `OwningProcess` (PID).

## Standard Start
From `pdp-next`:

```powershell
npm.cmd run dev
```

Expected healthy output:
- `Local: http://localhost:3000`
- `Ready in ...`

## Common Failure Pattern
Observed message:
- `Another next dev server is already running.`
- Existing PID is printed in output.

Meaning:
- A previous `next dev` process is still active in the same project directory.
- New invocation may attempt another port and then exit.

## Recovery (Fast Path)
1. Stop the existing process by PID shown in output.

```powershell
taskkill /PID <PID> /F
```

2. Confirm `3000` is no longer listening.

```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
```

3. Start server again.

```powershell
cd "c:\Dev\Personal\personal-dev-plan\pdp-next"
npm.cmd run dev
```

## Clean Restart Workflow
When switching branches or after dependency/env changes:
1. Stop running dev server PID.
2. Clear stale build cache only if behavior is inconsistent.

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
```

3. Restart with `npm.cmd run dev`.

## Notes
- Port `3001` fallback is not itself a failure, but the duplicate-server warning is.
- Keep one active `next dev` instance per project directory.

## Verification Record
- Date: 2026-05-23
- Root cause observed: duplicate `next dev` process already listening on `3000` (PID 8912)
- Recovery validated: killed stale PID, restarted cleanly
- Reliability check: 3 consecutive start/stop/restart cycles succeeded on `http://localhost:3000`
