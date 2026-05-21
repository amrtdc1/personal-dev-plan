# Personal Development Plan (Next.js Migration Workspace)

This folder contains the in-place migration target from the legacy Firebase + vanilla JS app to Next.js + Vercel + InstantDB.

## Current Phase

- Phase 0/1 foundation
- PWA baseline scaffolded (manifest + service worker placeholder)
- Shared domain model and repository contract bootstrapped

## Local Development

1. Copy `.env.example` to `.env.local`.
2. Fill values needed for your environment.
3. Start the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Docs

- `docs/IMPLEMENTATION_TRACKER.md`
- `docs/PHASE_0_BASELINE.md`

## Next Implementation Targets

1. Auth bootstrap flow + user profile initialization.
2. InstantDB wiring for goals/subgoals/tasks/journal.
3. Soft-delete lifecycle primitives with 60-day retention.
4. Offline write queue and sync reconciliation.
5. ICS export and secure subscription feed routes.
