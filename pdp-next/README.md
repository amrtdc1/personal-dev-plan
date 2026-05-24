# Personal Development Plan (Next.js Migration Workspace)

This folder contains the in-place migration target from the legacy Firebase + vanilla JS app to Next.js + Vercel + InstantDB.

## Current Phase

- Phase 1 foundation complete; parity and schema hardening in progress
- PWA baseline scaffolded (manifest + service worker placeholder)
- Shared domain model and repository contract bootstrapped
- Goals, subgoals, and tasks have repository-backed CRUD slices plus soft-delete lifecycle primitives

## Local Development

1. Copy `.env.example` to `.env.local`.
2. Fill values needed for your environment.
3. Start the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Validation

Run the current local quality gates before pushing changes:

```bash
npm run test
npm run lint
npm run build
```

Testing note:
- This workspace is configured with Vitest globals (`globals: true` and `types: ["vitest/globals"]`).
- Prefer globals (`describe`, `it`, `expect`, `vi`) in tests instead of importing from `vitest` to avoid known runtime startup failures.

## Vercel Preview Smoke Check

This repository is connected to Vercel for automatic preview deployments per feature branch.
After pushing a branch and waiting for the preview URL, run:

```bash
npm run smoke:preview -- https://<your-preview-url>
```

or set `PREVIEW_URL` and run:

```bash
PREVIEW_URL=https://<your-preview-url> npm run smoke:preview
```

The smoke check validates:
- app shell (`/`) is reachable
- PWA manifest (`/manifest.webmanifest`) is served
- protected goals API (`/api/goals`) rejects anonymous access with `401`

Automation:
- GitHub Actions now runs the same smoke check automatically on successful non-`main` deployment status events (including Vercel preview deployments).
- If a deployment event does not include a URL, run the workflow manually from Actions using the `preview_url` input.

## Docs

- `docs/IMPLEMENTATION_TRACKER.md`
- `docs/PHASE_0_BASELINE.md`
- `docs/BASELINE_SECURITY_CHECKLIST.md`

## Data Model

- InstantDB schema is formalized in `src/lib/instantdb/schema.ts`.
- CLI-friendly schema entrypoint is available at `instant.schema.ts`.
- This migration is now treating InstantDB as a fresh-start data store; no Firebase backfill is planned.

## InstantDB Setup

1. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_INSTANT_APP_ID`.
2. Set `INSTANT_ADMIN_TOKEN` for protected server routes.
3. Push the current schema to InstantDB:

```bash
npm run instant:push:schema
```

4. After the schema is stable, lock schema drift down with permissions:

```bash
npm run instant:push:perms
```

The app now exposes Instant's first-party auth sync route at `/api/instant` and the first protected server mutation at `/api/goals/[goalId]/status`.

## Web Push Setup (Phase 0)

1. Generate a VAPID keypair:

```bash
npm run push:generate:vapid
```

2. Copy the generated keys into `.env.local`:
	 - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
	 - `VAPID_PRIVATE_KEY`
	 - `VAPID_SUBJECT` (for example `mailto:notifications@example.com`)

3. Ensure your browser has granted notifications and your account has subscribed via the in-app install/notify banner.

4. Send a test push to your own subscribed devices:

```bash
curl -X POST http://localhost:3000/api/notifications/test \
	-H "Content-Type: application/json" \
	-d '{"title":"PDP Test","body":"Push pipeline is live.","url":"/"}'
```

Notes:
- `/api/notifications/test` is authenticated and only targets subscriptions owned by the calling user.
- Stale subscriptions are deleted automatically on `404/410` push provider responses.

## Reminder Push Triggers (Scaffold)

- User-triggered reminder send endpoint:
	- `POST /api/notifications/reminders/send` (authenticated)
	- Body: `{ "type": "daily_agenda" | "weekly_review" | "due_tasks" }`
	- Default type is `daily_agenda`

- Scheduler-triggered reminder run endpoint:
	- `POST /api/notifications/reminders/run`
	- Header: `x-pdp-cron-secret: <NOTIFICATION_CRON_SECRET>`
	- Optional body type payload as above
	- This route is intended for cron/scheduler integration and iterates subscribed owners.

- Notification preferences endpoints:
	- `GET /api/notifications/preferences` (authenticated)
	- `PUT /api/notifications/preferences` (authenticated)
	- Fields currently used: `dailyAgendaEnabled`, `weeklyReviewEnabled`, `dueTasksEnabled`, `preferredHourLocal`, `timezone`, `quietHoursStart`, `quietHoursEnd`

- Notification delivery history endpoint:
	- `GET /api/notifications/deliveries?limit=<n>&status=<sent|failed|skipped>&type=<daily_agenda|weekly_review|due_tasks|test>&before=<iso>&after=<iso>` (authenticated)
	- Returns most recent delivery log entries for the signed-in user.

- Notification delivery export endpoint:
	- `GET /api/notifications/deliveries/export?limit=<n>&status=<...>&type=<...>&before=<iso>&after=<iso>` (authenticated)
	- Returns CSV for filtered delivery rows.

- Reminder operations summary endpoint:
	- `GET /api/notifications/reminders/summary?hours=<n>`
	- Header: `x-pdp-cron-secret: <NOTIFICATION_CRON_SECRET>`
	- Returns aggregate scheduler delivery counts by status and reminder type for the requested time window.

- Reminder operations summary proxy endpoint (signed-in dashboard use):
	- `GET /api/notifications/reminders/summary-proxy?hours=<n>` (authenticated)
	- Performs secure server-side proxying to `/api/notifications/reminders/summary` with cron secret.

Scheduler enforcement notes:
- `/api/notifications/reminders/run` now respects reminder toggles and schedule preferences per owner.
- `weekly_review` is constrained to Sunday in the owner's local timezone.
- If `preferredHourLocal` is set, reminders send only at that local hour.
- If quiet hours are set, reminders are skipped while current local time falls in the quiet-hours window.
- Cooldown windows are also enforced per reminder type to avoid repeated sends during frequent scheduler runs:
	- `REMINDER_DAILY_COOLDOWN_HOURS` (default `20`)
	- `REMINDER_WEEKLY_COOLDOWN_HOURS` (default `144`)
	- `REMINDER_DUE_TASKS_COOLDOWN_HOURS` (default `4`)

## Calendar Feed (Scaffold)

- Authenticated feed token endpoint:
	- `GET /api/calendar/feed/token` (authenticated)
	- Returns a signed token, expiration timestamp, and a subscription URL for the current token revision.
	- `POST /api/calendar/feed/token` (authenticated)
	- Rotates token revision and returns a newly signed subscription URL (previous URLs become invalid).

- Tokenized ICS feed endpoint:
	- `GET /api/calendar/feed/<token>` (public token access)
	- Returns `text/calendar` with all-day projected goal/subgoal ranges and task due-date events.

Notes:
- Feed tokens are HMAC signed with `CALENDAR_FEED_SECRET`.
- Optional token lifespan override: `CALENDAR_FEED_TTL_DAYS` (default `365`).
- Token rotation invalidates older feed URLs immediately.

Local setup + quick test:
- Set `CALENDAR_FEED_SECRET` in `.env.local` (required).
- Generate a strong local secret with:
	- `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
- Restart `npm run dev` after changing `.env.local`.
- Sign in, open `Profile & Theme`, and copy the feed URL from `Calendar Subscription Feed`.
- Verify in browser: opening the URL should return `BEGIN:VCALENDAR` content.
- Verify rotation: click `Revoke & Rotate URL`, confirm, then open old URL again; it should return `{"error":"Calendar feed token has been rotated."}`.

## Notification Schema Additions (InstantDB)

- `notificationPreferences`
	- one row per owner (`ownerUid` unique)
	- enable/disable toggles for `daily_agenda`, `weekly_review`, and `due_tasks`
	- schedule and quiet-hour placeholders (`preferredHourLocal`, `timezone`, `quietHoursStart`, `quietHoursEnd`)

- `notificationDeliveries`
	- append-only-ish delivery audit records per owner/reminder
	- status tracking (`sent` | `failed` | `skipped`)
	- delivery counts and scheduler correlation (`schedulerRunId`)

After pulling these changes, push schema/perms updates:

```bash
npm run instant:push:schema
npm run instant:push:perms
```

## Next Implementation Targets

1. Expand protected server mutations beyond goal status updates.
2. Stand up `instant.perms.ts` and push permissions after the schema stabilizes.
3. Harden preview smoke checks and wire into PR validation.
4. Offline write queue and sync reconciliation.
5. Secure calendar feed and ICS export routes.
