# ADR-0005: Third-Party Vendor Defaults

Status: Accepted (defaults; individually overridable later)
Date: 2026-07-18
Deciders: Product Owner (approved via recommended defaults)

## Context

PRD-01 §11 explicitly lists several vendor decisions as open ("final cloud account, video provider,
WhatsApp provider, analytics/cookie-consent approach and payment account"). Building against a
concrete adapter requires picking a default even though these are swappable per
BACKEND-19 §6 (external provider adapters).

## Decision

Proceed with the following defaults, each behind a provider-agnostic adapter interface so the
choice can change later without touching business logic:

| Concern                | Default                                                             | Notes                                                                     |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Transactional email    | AWS SES                                                             | Swappable via `NotificationChannel` adapter                               |
| SMS / WhatsApp         | Twilio (SMS) + WhatsApp Business API                                | MSG91 is the fallback candidate for India-specific delivery rates         |
| Video hosting/playback | Cloudflare Stream                                                   | Signed playback URLs satisfy SRS Table 6's content-protection requirement |
| Payments               | Razorpay                                                            | Already mandated by SRS/PRD, not a default — confirmed, not chosen        |
| Object storage         | S3-compatible — MinIO locally, AWS S3 (or equivalent) in production | Matches MDG-00 stack                                                      |
| Malware/AV scanning    | ClamAV (containerized)                                              | Runs as a scan step in the upload pipeline (BullMQ job)                   |
| OAuth providers        | Google (primary)                                                    | Others addable via the same Passport.js strategy pattern                  |

## Consequences

- Sprint 0 does not wire any of these live (no external network calls from the skeleton) — it only
  needs to shape the codebase (adapter interfaces, config keys) so the Notifications sprint (Sprint 8) and the Payments sprint (Sprint 9) can plug in real credentials without refactoring. (Sprint
  numbers current as of the Sprint 5 resequencing; this ADR originally said Sprint 9/11.)
- Config module must accept per-provider environment variables even when unused locally, validated
  as optional in Sprint 0 and required-in-production later.

## Alternatives Considered

- **Wait for explicit vendor sign-off before writing any integration code**: rejected by Product
  Owner — would block the Notifications/Payments sprints entirely; adapters make the choice
  reversible.
