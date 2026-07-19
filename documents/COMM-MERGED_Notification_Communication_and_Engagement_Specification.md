# NOTIFICATION, COMMUNICATION & ENGAGEMENT SPECIFICATION (MERGED)

Document: COMM-MERGED (supersedes COMM-11 and COMM-31 for implementation purposes)
Version: 1.0
Status: Reconciled per product-owner decision on 2026-07-18. COMM-11 (doc 11) and COMM-31 (doc 31)
remain in `/documents` as historical inputs; this document is the single source of truth the
Notification Service is built against.

## 1. Purpose

Defines the notification, messaging, communication and engagement framework for students,
mentors, reviewers, administrators and guardians across the platform, reconciling the two
overlapping source specifications (COMM-11, COMM-31).

## 2. Communication Channels

- Email
- SMS
- WhatsApp
- In-App Notifications
- Web Push (browser push notifications — in scope for the responsive web platform)
- Mobile Push — **deferred**: tied to a native mobile app, which PRD-01 §9 lists as a non-goal for
  initial release. Design the notification service with a Mobile Push adapter interface now so it
  can be enabled later without rework, but do not build the delivery integration in MVP scope.

## 3. Notification Events

Merged and de-duplicated from both source documents, grouped by domain:

**Account & Security**

- User registration
- OTP / email verification
- Welcome message
- Password reset
- Account security alerts (new device/login, suspicious activity)

**Learning & Assessment**

- Course enrollment
- Daily study reminder
- Quiz reminder
- Quiz result released
- Mock test reminder
- Live class reminder
- Doubt reply available

**Creative Assignments**

- Assignment published
- Assignment due reminder
- Submission received
- Feedback published

**Mentoring**

- Mentor assigned
- Mentor task assigned
- Session scheduled or updated

**Commerce**

- Payment success/failure
- Certificate issued

**Platform & Community** (from COMM-11; retained — COMM-31 omitted these but they remain required
per ADMIN-08 and doc 08 Community Moderation)

- Community moderation action
- Broadcast announcement (cohort or platform-wide)
- System maintenance announcement

## 4. Notification Templates

Reusable templates with placeholders for learner name, course, exam, mentor, schedule, links and
branding (per COMM-31 §4), covering at minimum the template catalog from COMM-11 Table 1: Welcome,
Assignment Reminder, Quiz Reminder, Feedback Ready, Payment Receipt, Password Reset, Announcement —
extended with OTP Verification, Live Class Reminder, Doubt Reply, and Certificate Issued templates.

## 5. User Preferences

- Opt-in/opt-out per channel
- Mute by category
- Do Not Disturb schedule
- Digest vs. instant delivery
- Reminder timing configuration
- Language preference
- Guardian communications remain disabled until verified consent is recorded (BR-06, SRS-02)

## 6. Delivery Workflow

Application event generated → Notification service receives event → Template selected →
Personalization variables resolved → Channel selected based on user preferences → Message queued →
Provider delivery → Delivery status stored → Failed deliveries retried per policy (§8).

Scheduling supports immediate, scheduled and recurring notifications, event-driven workflows, and
is timezone-aware (per COMM-31 §6).

## 7. Delivery Status Taxonomy (reconciled)

COMM-11 and COMM-31 used different, incompatible state lists. Merged taxonomy — the full lifecycle
a message can pass through, used consistently across all channels and reporting:

`Queued → Sent → Delivered → Opened → Clicked → Acknowledged`

Side/terminal states, applicable at any point after `Queued`:

- `Failed` — provider rejected or delivery could not complete
- `Retried` — a failed delivery was resent
- `Suppressed` — not sent, due to user opt-out, consent gate, or rate limit (retained from COMM-11;
  omitted in COMM-31 but required for consent-compliance reporting per DATA-27)

`Acknowledged` applies where a notification requires explicit user action to resolve (e.g., task
assignment, revision request) — distinct from `Clicked`, which only confirms link engagement.

## 8. Retry & Failure Handling

Automatic retries with backoff, dead-letter queue for repeatedly failed messages, fallback channel
escalation (e.g., WhatsApp → SMS on failure), and administrator alerting on sustained provider
failure (per COMM-31 §8 — this capability was absent from COMM-11 and is adopted platform-wide).

## 9. Analytics

Delivery rate, open rate, click-through rate, engagement rate, reminder effectiveness, opt-out
rate, notification latency, and bounce/failure rate (merged from both sources).

## 10. Security & Compliance

Consent-based communication, role-based messaging permissions, unsubscribe options, encrypted
communication in transit, audit logs for broadcasts and moderation notices, rate limiting, and
provider webhook signature verification.

## 11. Success Metrics

- **>98% delivery success** (adopted as the platform-wide SLA per COMM-31 §11, applied to all
  channels rather than treated as a single-document target)
- High reminder engagement
- Reduced learner inactivity
- Improved course completion
- Increased live class attendance
- Notification latency and bounce/failure rate within operational targets (COMM-11 §10)

## 12. Provider Adapters (implementation note, not part of original specs)

Per the technology-stack defaults approved for this project, the Notification Service should be
built against a provider-agnostic adapter interface so vendors can be swapped without touching
business logic:

- Email: AWS SES (default)
- SMS/WhatsApp: Twilio or MSG91, WhatsApp Business API
- Web Push: standard Web Push API (VAPID)
- Mobile Push: adapter interface only, no live integration until a native app exists
