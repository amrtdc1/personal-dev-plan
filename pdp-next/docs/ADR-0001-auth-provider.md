# ADR-0001: Authentication Provider Strategy

## Status
Accepted

## Date
2026-05-21

## Context
The legacy application used Firebase Auth with multiple user-facing flows (Google popup auth, email/password signup/signin, password reset, and account management). During migration to Next.js + InstantDB, we needed to choose an initial authentication approach that enables incremental delivery with minimal integration overhead.

Key constraints:
- Migration is in-place and slice-based.
- Early slices prioritize stable data access and profile bootstrap.
- Team requested Magic Code as the initial login UX.
- Secondary provider support can be introduced later if it does not block parity gates.

## Decision
Use InstantDB Magic Code as the primary authentication mechanism for the migration baseline.

Decision details:
- Phase 1 auth baseline is Magic Code sign-in/sign-out.
- User profile bootstrap runs after first successful auth.
- Google auth is deferred as an optional secondary provider after core parity stability.
- Account management parity (password reset/change/delete) is deferred and must be redesigned to fit InstantDB auth model and server-side ownership controls.

## Consequences
### Positive
- Fastest path to secure, working auth in the new stack.
- Reduced auth integration complexity during foundational migration slices.
- Consistent with agreed product direction for coworker-friendly login.

### Trade-offs
- Legacy email/password and Google parity is not immediate.
- Account management UX requires follow-up design for non-password-based auth model.

### Follow-up Work
1. Define secondary provider requirements (Google) and whether coexistence is required long term.
2. Document account recovery and credential management behavior for Magic Code users.
3. Add server-side ownership and authorization checks to all mutation routes before broad rollout.

## Alternatives Considered
- Keep Firebase Auth during early migration: rejected due to split-auth complexity and increased migration surface.
- Implement Google + Magic Code simultaneously: rejected due to scope expansion before core parity gates.
- Build custom auth first: rejected due to unnecessary risk and delivery delay.
