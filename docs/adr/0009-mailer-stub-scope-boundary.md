# ADR-0009: Console Mailer Is a Sprint 1 Placeholder, Not the Notification Service

Status: Accepted
Date: 2026-07-18
Deciders: Engineering

> Note: every "Sprint 9" reference below is to the Notifications sprint under the numbering at the
> time this ADR was written. After the Sprint 5 resequencing (see
> `docs/roadmap/SPRINT_BACKLOG.md`), that sprint is now **Sprint 8**.

## Context

Sprint 1's scope excludes "Notification ... functionality" (per the sprint instruction), but email
verification, password reset, and future flows need to send email _now_. Building the full
Notification Service (COMM-MERGED: multi-channel templates, delivery tracking, preferences) is
Sprint 9 scope and would be a large, out-of-scope expansion if pulled forward.

## Decision

Introduce a minimal `MailerPort` interface (`apps/api/src/mailer/mailer.port.ts`) with exactly one
method, `send({to, subject, text})`, implemented in Sprint 1 by `ConsoleMailerService` — which only
logs the email via the structured logger instead of delivering it. `AuthService` depends only on
`MailerPort` (injected via the `MAILER_PORT` token), never on the concrete implementation.

## Consequences

- No template system, no delivery tracking, no multi-channel logic, no user preferences — those
  remain exclusively Sprint 9 scope, implementing COMM-MERGED in full.
- Sprint 9 replaces `ConsoleMailerService` with a real adapter (SES per ADR-0005) — `AuthService`'s
  call sites do not change.
- Local/CI runs never send real email; verification/reset tokens are only ever visible in
  application logs (or, in e2e tests, via a test-double `MailerPort` implementation that captures
  sent messages — see `apps/api/test/support/test-mailer.ts`).
- Tracked as TD-013 in the debt register: this stub must not be mistaken for production-readiness.

## Alternatives Considered

- **Build a minimal real email integration now (e.g., SES) instead of a stub**: rejected — pulls
  vendor credential management and delivery-tracking concerns into Sprint 1 for no benefit; the
  interface boundary makes this a pure Sprint 9 swap either way.
- **Skip email verification/reset entirely until Sprint 9**: rejected by the Sprint 1 scope
  instruction, which explicitly lists Email Verification, Forgot Password and Reset Password as
  required deliverables.
