# ADR-0019: Notification, Communication & Engagement Service

Status: Accepted
Date: 2026-07-25
Deciders: Engineering (Sprint 9 kickoff)

## Context

Sprint 9 implements the Notification Service defined by COMM-MERGED (ADR-0004's reconciliation of
COMM-11/COMM-31), integrated across eight existing modules (Auth, Enrollment, Payments, Learning,
Quiz, Assignments, Mentor, Community). This is the first genuinely cross-cutting service in the
codebase — every other feature module is a consumer, none is a dependency — and it retires TD-013
(`ConsoleMailerService`, the Sprint 1 stub explicitly documented as "replaced wholesale by the
Notification Service in Sprint 9").

The sprint kickoff scoped this narrower than old Sprint 10's combined "Notifications & Creative
Gallery" bundle: only the notification/communication/engagement half. See D-54 for the roadmap
resequencing this required.

## Decisions

### 1. Module shape: `@Global()`, base tier, zero feature-module imports

`NotificationModule` mirrors `AuditModule`'s existing pattern (`@Global()`, exports one service) not
`EnrollmentModule`'s (imported explicitly by each consumer). With eight consumers, explicit imports
would mean eight `imports: [NotificationModule]` edits scattered across the module graph; `@Global()`
is the established idiom for a cross-cutting concern already proven by `AuditModule`. The module
itself imports nothing from any feature module — it only needs `PrismaService` (already global) and
the BullMQ queue — so it sits at the same "base tier" as `EnrollmentModule` in ADR-0018's dependency
graph, just reached via global DI instead of explicit `imports`.

### 2. Integration pattern: direct service injection, not an event bus

Every consumer service (`AuthService`, `EnrollmentService`, `PaymentsService`, etc.) injects
`NotificationsService` directly and calls `.enqueue(...)` at its existing success point — exactly the
same pattern already used for `AuditService.record(...)` everywhere in this codebase. An
`@nestjs/event-emitter` pub/sub layer was considered (it would let consumers stay fully unaware of
Notifications) but rejected: it introduces a second cross-cutting-integration idiom alongside the
already-established direct-injection one, for no benefit this sprint actually needs — every call site
is a single line at a single, well-defined completion point (per the Sprint 9 kickoff research pass),
not a fan-out to many uncoordinated listeners.

### 3. `MailerPort`/`ConsoleMailerService` retired; `AuthService` call sites change

TD-013's original doc comment planned for `AuthService`'s three `mailer.send(...)` call sites
(register/verify, resend-verification, forgot-password) to stay unchanged, with only the DI binding
swapped. That plan predates the Sprint 9 kickoff's explicit requirement for delivery tracking on
these exact events ("Registration", "Email Verification", "Password Reset", "Security Alert" are
named integration examples) — a raw `mailer.send()` call has no delivery-state row, no retry, no
audit trail beyond the pre-existing generic audit log. All three call sites now go through
`NotificationsService.enqueue(...)` instead, each marked `isTransactional: true` (see §5). `mailer/`
is deleted; `NotificationModule`'s own `EmailChannelPort` (same interface shape as the old
`MailerPort`) is the sole caller of the email provider adapter now.

### 4. Delivery-state taxonomy is exactly COMM-MERGED §7, unmodified

`Queued → Sent → Delivered → Opened → Clicked → Acknowledged`, with `Failed`/`Retried`/`Suppressed` as
side/terminal states — implemented as the `NotificationDeliveryStatus` enum on `NotificationDelivery`,
one row per (notification, channel). This is deliberately the ADR-0004-reconciled taxonomy, not a
simplified subset — `Suppressed` in particular is required for DATA-27 consent-compliance reporting
and is easy to omit by accident (COMM-31 itself omitted it before the merge).

### 5. Transactional notifications bypass preference-based suppression

Security-critical auth flows (password reset, email verification) must never be silently dropped by
a user's mute/DND/channel-opt-out preferences — a user who muted "Account & Security" should still be
able to recover their account. `Notification.isTransactional: boolean` marks these; the delivery
pipeline skips `NotificationPreference` suppression checks (but not template rendering or delivery
tracking) for transactional notifications, always attempting the specified channel. This is not
explicit in COMM-MERGED but follows directly from BR-06/SRS-02's consent framework, which gates
_marketing/engagement_ communication, not account-recovery communication.

### 6. Provider adapters: one port per channel, mirroring `PaymentGatewayPort`/`StoragePort`

- `EmailChannelPort` — real: AWS SES adapter (`configured` boolean gate, same pattern as
  `RazorpayGatewayService`); fallback: logs instead of sending, exactly like the old
  `ConsoleMailerService`, when SES credentials are absent.
- `SmsChannelPort` — Twilio/MSG91 adapter interface; same configured/log-fallback pattern.
- `WhatsAppChannelPort` — WhatsApp Business API adapter interface; same pattern.
- `WebPushChannelPort` — standard Web Push (VAPID) adapter; real implementation (the `web-push` npm
  package needs no paid account, only a VAPID keypair, so this one is live-testable without a real
  vendor account, unlike SMS/WhatsApp/Email).
- `MobilePushChannelPort` — **interface only** (per ADR-0004 — tied to a native app, PRD-01 §9
  non-goal). No real or fake implementation is registered; any attempt to resolve it throws
  `NotImplementedException` from a stub that exists purely so the port compiles against the same
  `NotificationChannelPort` shape as the other five, ready to receive a real adapter without any
  interface change later.

Every real adapter follows the `configured` boolean precedent from ADR-0018 (Razorpay) and ADR-0005
(Google OAuth): the app boots and every automated test passes with zero real credentials, using fake
adapters registered via `overrideProvider` in tests, exactly like `FakePaymentGatewayService`.

### 7. Retry, DLQ, and fallback are BullMQ-native, not a second DB-tracked queue

Retry (`attempts` + exponential `backoff`) and dead-lettering reuse BullMQ's own built-in mechanisms —
identical to the Sprint 5 malware-scan queue's `{ attempts: 3, backoff: { type: "exponential", delay:
5000 } }` — rather than inventing a parallel database-tracked retry/DLQ system. A job that exhausts
its attempts is BullMQ's own "failed" job; a `QueueEvents` listener on the `failed` event (final
attempt only) is what (a) marks the corresponding `NotificationDelivery.status = FAILED`, (b) records
an `AuditService` entry for "sustained provider failure" alerting (COMM-MERGED §8 — no real
paging/alerting channel exists yet, so this is the alerting foundation, not the full capability), and
(c) triggers channel fallback (WhatsApp → SMS, etc.) by enqueuing a _new_ `NotificationDelivery` +
BullMQ job on the fallback channel, linked via `NotificationDelivery.fallbackFromId`.

### 8. In-app notifications and delivery-tracking rows are separate models

`Notification` (one row per user per event — powers the Notification Center, read/unread) is distinct
from `NotificationDelivery` (one row per notification per channel — powers delivery-state tracking).
A single event fanning out to Email + In-App + Web Push produces one `Notification` and three
`NotificationDelivery` rows. `IN_APP` is modeled as a channel like any other (its "delivery" is
instantaneous — the row is created `DELIVERED` immediately, no queue hop needed) so the same
read/unread and delivery-tracking machinery serves it without a special case.

### 9. Broadcasts reuse the same fan-out, not a separate aggregate model

A cohort/platform-wide announcement (admin-triggered) creates one `Notification` + its
`NotificationDelivery` row(s) _per targeted recipient_, rather than a single shared `Broadcast` row
that every recipient reads from. This costs more storage for large broadcasts but keeps read/unread
state genuinely per-recipient (required — two students should be able to read the same announcement
independently) and avoids a second notification-rendering code path in the Notification Center UI.

### 10. Scheduled/recurring reminders: infrastructure proven, not fully built out

BullMQ supports delayed (`delay: ms`) and repeatable (`repeat: { pattern: cron }`) jobs natively —
the same queue used for immediate notifications handles scheduled ones with no new infrastructure.
This sprint wires exactly one concrete scheduled example (assignment due-date reminder, delayed off
the existing `Assignment.deadline` field) to prove the capability end-to-end. A general-purpose daily
study-reminder/quiz-reminder _cron engine_ (which needs a "what should this user be reminded about
today" query across their active enrollments — a genuinely new piece of domain logic, not just
scheduling plumbing) is deferred — see TD-041.

## Consequences

- Every existing module gains exactly one new constructor dependency (`NotificationsService`) at its
  integration point(s) — the same DI-ripple-effect discipline from ADR-0018 applies: any test file
  that builds its own `Test.createTestingModule({ providers: [...] })` for `AuthService`,
  `EnrollmentService`, `PaymentsService`, `ReviewerService` (assignments), `MentorAssignmentService`,
  `RepliesService`, or `ThreadsService` needs `NotificationsService` added to its providers.
- `MailerModule`/`MAILER_PORT` is deleted, not deprecated-in-place — nothing outside
  `NotificationModule` references it after this sprint.
- `Notification`/`NotificationDelivery`/`NotificationTemplate`/`NotificationPreference`/
  `WebPushSubscription` are five new models; `User` gains four new back-relations.
- `notification:read` (baseline) and `notification:manage` (admin) are new permission codes.

## Alternatives Considered

- **Event emitter (`@nestjs/event-emitter`) instead of direct injection**: rejected per §2 — no
  current requirement needs decoupled fan-out, and mixing two cross-cutting-integration idioms in one
  codebase (direct injection for Audit, events for Notifications) costs more in consistency than it
  buys in decoupling.
- **A single unified `NotificationChannelPort` with a `channel` parameter instead of five separate
  ports**: rejected — Email/SMS/WhatsApp/WebPush/MobilePush have genuinely different addressing
  (email address vs. phone vs. push-subscription-object) and payload shapes; a single interface would
  need channel-specific optional fields on every call, the same problem `PaymentGatewayPort` avoided
  by being Razorpay-shaped rather than generic.
- **A database-tracked DLQ table**: rejected per §7 — BullMQ's own failed-job store already _is_ a
  DLQ; a parallel table would duplicate state that can drift from the real queue state.
