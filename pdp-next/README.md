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

## Next Implementation Targets

1. Expand protected server mutations beyond goal status updates.
2. Stand up `instant.perms.ts` and push permissions after the schema stabilizes.
3. Harden preview smoke checks and wire into PR validation.
4. Offline write queue and sync reconciliation.
5. Secure calendar feed and ICS export routes.
