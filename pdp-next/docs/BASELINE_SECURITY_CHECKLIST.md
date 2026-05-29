# Baseline Security Checklist

Status: Active Reference
Last Updated: 2026-05-29
Owner: Engineering

## Purpose
Track minimum security controls required before parity cutover.

## Status Legend
- Done: implemented and verified
- In Progress: partial coverage
- Not Started: no implementation yet

## Checklist
| Control | Requirement | Status | Notes |
| --- | --- | --- | --- |
| Client-side XSS prevention | Do not render untrusted HTML directly from user input | In Progress | Strict markdown renderer utility + regression tests enforce escaped HTML and protocol-safe links; repository-backed journal preview now renders through strict markdown, with edit/display parity still pending |
| Server-side ownership checks | Every read/write/delete validates current user owns target record | Done | Protected owner-scoped goals/subgoals/tasks/profile routes are in place; automated route-auth contract test now guards non-public API handlers (`src/lib/server/route-auth-contract.test.ts`) |
| Destructive action safeguards | Confirm dialogs, scoped deletes, and audit-friendly metadata | In Progress | UI confirms exist in legacy; new stack still needs server-enforced guardrails |
| Soft-delete lifecycle | 60-day retention with restore and purge windows | Done | Archive/restore flows, restore-window enforcement, and owner-scoped purge execution are implemented with regression coverage |
| Auth session integrity | Auth-only access to private user data and mutation paths | Done | Auth guard contract is regression-tested for all non-public API routes; explicit public allowlist is limited to Instant auth sync and college teams catalog |
| Input validation | Validate all persisted payloads (title, dates, status enums, ordering indexes) | In Progress | Centralized validation helpers cover repository writes/profile writes and reorder/status mutations, and protected write payload parsers now have regression tests; schema-level enforcement still needs to be added |
| Error handling | Do not leak sensitive internals in client-visible error messages | In Progress | Shared route error handling now normalizes unexpected server errors to safe 500 responses; add regression tests for this contract |
| Dependency hygiene | Keep dependencies patched and lockfile tracked | In Progress | Lockfile committed; recurring audit process not yet defined |
| CSP and response headers | Set security headers and lock trusted origins | Done | CSP finalized with frame/base/form restrictions plus image/connect constraints; response headers include `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` |
| Remote media restrictions | Restrict external image domains and sanitize stored URLs | Done | ESPN logo URL sanitization + domain allowlist added in provider, Next image remote patterns restrict configured hosts, and profile write persist-path validation enforces https + allowlisted domains |

## Immediate Actions (Next)
1. Define recurring dependency audit cadence and enforcement in CI.
2. Complete strict markdown integration for journal edit/display parity beyond migration preview.
