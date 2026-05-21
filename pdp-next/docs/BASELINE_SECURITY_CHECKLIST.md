# Baseline Security Checklist

## Purpose
Track minimum security controls required before parity cutover.

## Status Legend
- Done: implemented and verified
- In Progress: partial coverage
- Not Started: no implementation yet

## Checklist
| Control | Requirement | Status | Notes |
| --- | --- | --- | --- |
| Client-side XSS prevention | Do not render untrusted HTML directly from user input | In Progress | Strict markdown renderer utility + regression tests now enforce escaped HTML and protocol-safe links; journal UI integration is still pending |
| Server-side ownership checks | Every read/write/delete validates current user owns target record | In Progress | Protected owner-scoped goals/subgoals/tasks routes are implemented; remaining work is broader endpoint expansion and automated route tests |
| Destructive action safeguards | Confirm dialogs, scoped deletes, and audit-friendly metadata | In Progress | UI confirms exist in legacy; new stack still needs server-enforced guardrails |
| Soft-delete lifecycle | 60-day retention with restore and purge windows | Done | Archive/restore flows, restore-window enforcement, and owner-scoped purge execution are implemented with regression coverage |
| Auth session integrity | Auth-only access to private user data and mutation paths | In Progress | Magic Code baseline and protected auth-gated goals/subgoals/tasks routes are in place; add route-level regression tests for contract hardening |
| Input validation | Validate all persisted payloads (title, dates, status enums, ordering indexes) | In Progress | Centralized validation helpers cover repository writes and reorder/status mutations, and protected write payload parsers now have regression tests; schema-level enforcement still needs to be added |
| Error handling | Do not leak sensitive internals in client-visible error messages | In Progress | Shared route error handling now normalizes unexpected server errors to safe 500 responses; add regression tests for this contract |
| Dependency hygiene | Keep dependencies patched and lockfile tracked | In Progress | Lockfile committed; recurring audit process not yet defined |
| CSP and response headers | Set security headers and lock trusted origins | In Progress | Next headers added; CSP policy not finalized |
| Remote media restrictions | Restrict external image domains and sanitize stored URLs | Done | ESPN logo URL sanitization + domain allowlist added in provider, Next image remote patterns restrict configured hosts, and profile write persist-path validation enforces https + allowlisted domains |

## Immediate Actions (Next)
1. Define and implement centralized payload validation for goals/subgoals/tasks/journal writes.
2. Integrate strict markdown rendering into journal display/edit flows.
3. Finalize CSP policy and lock trusted script/image/connect origins.
