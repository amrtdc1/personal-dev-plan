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
| Client-side XSS prevention | Do not render untrusted HTML directly from user input | In Progress | Legacy journal preview used markdown HTML rendering; Next.js parity flow must sanitize or render safely |
| Server-side ownership checks | Every read/write/delete validates current user owns target record | In Progress | Shared ownership guard helpers exist in the data layer; route-level server enforcement is still pending because no protected route handlers exist yet |
| Destructive action safeguards | Confirm dialogs, scoped deletes, and audit-friendly metadata | In Progress | UI confirms exist in legacy; new stack still needs server-enforced guardrails |
| Soft-delete lifecycle | 60-day retention with restore and purge windows | In Progress | Repository archive/restore flows and cascade tests are implemented; purge automation and restore-window enforcement still need server-side execution |
| Auth session integrity | Auth-only access to private user data and mutation paths | In Progress | Magic Code baseline in place; route-level enforcement still pending |
| Input validation | Validate all persisted payloads (title, dates, status enums, ordering indexes) | In Progress | Centralized validation helpers now cover repository writes and reorder/status mutations; server-route validation and schema-level enforcement still need to be added |
| Error handling | Do not leak sensitive internals in client-visible error messages | In Progress | Current messages are mostly generic; standardization still needed |
| Dependency hygiene | Keep dependencies patched and lockfile tracked | In Progress | Lockfile committed; recurring audit process not yet defined |
| CSP and response headers | Set security headers and lock trusted origins | In Progress | Next headers added; CSP policy not finalized |
| Remote media restrictions | Restrict external image domains and sanitize stored URLs | Not Started | Required for upcoming logo/theme provider integration |

## Immediate Actions (Next)
1. Add server-side ownership checks for all planned data mutation endpoints.
2. Define and implement centralized payload validation for goals/subgoals/tasks/journal writes.
3. Implement purge execution and restore-window enforcement for soft-deleted records.
4. Introduce safe markdown strategy for journal (sanitize or strict markdown renderer).
5. Add domain allowlist validation for remote logo URLs before render/persist.
