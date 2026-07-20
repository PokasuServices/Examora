# ADR-0004: Merge COMM-11 and COMM-31 into a Single Notification Specification

Status: Accepted
Date: 2026-07-18
Deciders: Product Owner

## Context

Two overlapping notification specs exist: `11_Notification_and_Communication_Module_Specification`
(COMM-11) and `31_Notification_Communication_and_Engagement_Specification` (COMM-31, added to the
documents folder after the initial review). They disagree on delivery-state taxonomy (COMM-11 has
`Suppressed`, no `Clicked`/`Acknowledged`; COMM-31 has the reverse) and channel scope (COMM-31 lacks
COMM-11's maintenance-announcement and moderation-action events).

## Decision

Use **COMM-31 as the base** (it is the more complete spec: DLQ/fallback-channel handling, numeric
98% delivery SLA, language/timezone preferences) and **fold in COMM-11's missing functionality**:
maintenance announcements, community-moderation-action events, and the `Suppressed` delivery state
(required for consent-compliance reporting per DATA-27). The merged result is
`documents/COMM-MERGED_Notification_Communication_and_Engagement_Specification.md`, which is
authoritative for implementation. COMM-11 and COMM-31 remain in `/documents` as historical inputs.

## Consequences

- The Notification Service's delivery-state machine is:
  `Queued → Sent → Delivered → Opened → Clicked → Acknowledged`, with `Failed`/`Retried`/`Suppressed`
  as side/terminal states — this exact taxonomy must be used in the Prisma schema and any
  analytics/reporting built on top of it.
- Mobile Push is scoped as an adapter interface only in Sprint 0/MVP (no live integration), since it
  depends on a native app, which PRD-01 §9 lists as a non-goal for this release. Web Push (browser)
  is in scope.
- > 98% delivery success is adopted as a platform-wide SLA, not a channel-specific target.

## Alternatives Considered

- **Carry the conflict forward, resolve inline during the Notifications sprint** (Sprint 8; was
  Sprint 9 when this ADR was written, before the Sprint 5 resequencing): rejected by Product Owner
  in favor of resolving now, before any schema or service code depends on either
  taxonomy.
