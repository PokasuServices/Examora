# Examora Platform — Implementation Roadmap

Status: Baseline approved 2026-07-18. Maintain this document as phases complete or scope changes.
Governing documents: MDG-00 (process), PRD-01 (release sequencing), SRS-02 (requirements).

This roadmap sequences delivery across six phases. Phase boundaries follow PRD-01's release plan;
the sprint-level breakdown for each phase lives in `docs/roadmap/SPRINT_BACKLOG.md`.

## Phase 0 — Foundation (Sprint 0)

**Goal**: A buildable, deployable skeleton with no business logic.
**Scope**: Monorepo scaffold, CI/CD, local Docker environment, design tokens placeholder, baseline
Prisma schema (identity/audit only), authentication skeleton, health checks, observability wiring
stubs.
**Exit criteria**: `pnpm build`, `pnpm lint`, `pnpm test` pass in CI; `docker compose up` brings up
Postgres/Redis/MinIO; `apps/api` boots and serves `/health` and `/api/docs`; `apps/web` and
`apps/admin` boot and render a placeholder page; a user can register/login/refresh/logout against
the skeleton auth endpoints.

## Phase 1 — MVP: Core Learning & Assessment (Sprints 1-4, 10)

**Goal**: A student can register, enroll, learn, and take a scored quiz.
**Scope**: Full RBAC, course/subject/topic/module CMS + delivery, progress tracking, quiz engine
(configuration, attempt lifecycle, autosave, scoring, reports, question reporting), basic admin CMS.
**Key docs**: SRS-02 FR-AUTH/PROFILE/COURSE/CONTENT/PROGRESS/QUIZ/REPORT, ASSESS-09, DB-05/16/34,
API-17.
**Exit criteria**: All Phase 1 FR-IDs in SRS-02 Table 3 have passing automated tests; a full
register → enroll → learn → quiz → report journey works end-to-end in staging.

> Resequenced after Sprint 4: Scoring/Reports/Recommendations v0 (the phase's closing sprint) first
> moved to Sprint 6, after Sprint 5 (Creative Assignment Engine, Phase 2's opening sprint) rather
> than before it — approved ahead of Sprint 5. Resequenced again after Sprint 5: Mentor Management
> (Phase 2, previously planned as Sprint 7) was approved to run as Sprint 6 instead, moving
> Scoring/Reports/Recommendations v0 to Sprint 7. Resequenced a third time after Sprint 6: the
> Community & Discussion module (split out of old Sprint 8's bundle) was approved to run as Sprint
> 7 instead, moving Scoring/Reports/Recommendations v0 to Sprint 8. Resequenced a fourth time after
> Sprint 7: Commerce, Enrollment & Payments (see Phase 4) was approved to run as Sprint 8 instead,
> moving Scoring/Reports/Recommendations v0 to Sprint 9 — this also resolves TD-020's deferred
> enrollment gate far earlier than originally planned. Resequenced a fifth time after Sprint 8: the
> notification/communication half of Phase 2's notification-service sprint (see below) was approved
> to run as Sprint 9 instead, moving Scoring/Reports/Recommendations v0 to Sprint 10. No functional
> dependency blocks any of these moves: Creative Assignments, Mentor Management, Community/
> Discussion, Commerce/Enrollment, and notification delivery all operate independently of the quiz
> engine's own scoring/reports/recommendations feature. Phase 1 therefore interleaves with Phases
> 2/3/4 by sprint number instead of running back-to-back; each phase's own exit criteria still gate
> its own completion regardless of interleaving.

## Phase 2 — Mentor-Led Learning (Sprints 5-6, 9)

**Goal**: Creative submissions and human mentoring close the feedback loop.
**Scope**: Creative assignment authoring/submission/upload validation/malware scan, rubric review
workspace (annotations deferred — see Sprint 5 backlog note), mentor management, Student 360,
mentor workflow (notes/tasks/feedback/meetings), merged notification service (COMM-MERGED) going
live on real channels. Cohorts and at-risk-alert escalation, originally scoped into this phase's
mentoring sprint, are deferred — see Sprint 6 backlog note. (The notification-service sprint was
renumbered from 9 to 10 by the Sprint 8 resequencing, then to 9 by the Sprint 9 resequencing below —
back to its original number, now carrying only the notification/communication half of the old
combined sprint.)
**Key docs**: CREATIVE-10, DESIGN-03, COMM-MERGED, SRS-02 FR-ASSIGN/REVIEW/MENTOR.
**Exit criteria**: A mentor can review a real submission end-to-end (score via rubric, publish
feedback, request revision) with full audit trail; notification delivery SLA ≥98% in staging load
test.

## Phase 3 — Creative Community (Sprints 7, 11)

**Goal**: Safe peer learning.
**Scope**: Discussion forums, doubt resolution, comments/likes/bookmarks/follow, moderation tooling
(report/hide/restore/lock/pin), search (Sprint 7 — the discussion/moderation half of FR-COMM-01/02);
revision cycles, XP/achievements with anti-fraud idempotency, consent-gated community gallery, peer
rating (Sprint 11, alongside Growth Modules & Full Admin — CREATIVE-10 §8-10).
**Key docs**: CREATIVE-10 §8-10, SRS-02 FR-COMM-01/02, doc 08 §Community Moderation.
**Exit criteria**: Private-by-default enforced with tests; moderator can hide reported content within
SLA; XP cannot be awarded twice for the same action (idempotency test).

> Resequenced after Sprint 6: this phase's scope splits across two sprints instead of one — the
> discussion-forum/doubt-resolution/moderation half (FR-COMM-01/02) runs as Sprint 7, ahead of the
> creative gallery/peer-rating/XP half (CREATIVE-10 §8-10), which moved to Sprint 9 alongside
> notification delivery, then to Sprint 10 after the Sprint 8 resequencing, then to Sprint 11
> (alongside Growth Modules & Full Admin rather than notifications) after the Sprint 9 resequencing
> below — see D-54. The gallery/peer-rating/XP half is functionally independent of both the
> discussion-forum half (text-based threads vs. a media gallery with ratings/gamification) and of
> notification delivery, so it can attach to whichever adjacent sprint has room without blocking
> anything.

## Phase 4 — Growth & Counselling (Sprint 8, 11-12)

**Goal**: Monetization and acquisition.
**Scope**: Course enrollment/access-control/entitlements/purchase history, pricing/coupons/discounts,
orders/invoices, a refund-workflow foundation, Razorpay payment orders/webhooks/entitlements,
transaction logging (Sprint 8 — Commerce, Enrollment & Payments); articles, events/webinars, college
directory, consented enquiries, full admin (question-bank approval workflow, community moderation
admin, analytics dashboards, moderation escalation) (Sprints 11-12).
**Key docs**: SRS-02 FR-PAY/EVENT/COLLEGE/ENQ, ADMIN-08, ANALYTICS-12, DB-05 §3.
**Exit criteria**: Webhook signature verification tested against forged/duplicate events; entitlement
granted only from verified webhook, never client callback; a non-entitled student cannot access paid
Learning/Quiz/Assignment/Mentor content; admin can complete every workflow listed in ADMIN-08 §5.

> Resequenced after Sprint 7: Commerce, Enrollment & Payments (previously planned as Sprint 10,
> narrower in scope — payments/entitlements only, no enrollment or commerce/coupon model) was
> approved to run as Sprint 8 instead, immediately after Community & Discussion, absorbing the
> enrollment gate TD-020 had deferred. This phase therefore now interleaves with Phase 2 (Sprint 9),
> Phase 1 (Sprint 10), and Phase 3 (Sprint 11) by sprint number rather than running as a contiguous
> block — the same interleaving pattern Phase 1 already established. No functional dependency is
> violated: Commerce/
> Enrollment/Payments only needs read access to existing Learning/Quiz/Assignment/Mentor/Community
> catalog data to gate it, not the reverse.

## Phase 5 — Stabilization (Sprint 13)

**Goal**: Release readiness.
**Scope**: Performance testing against PERF-32 targets, security review against SEC-13, accessibility
audit (WCAG 2.1 AA), full regression pass, UAT per QA-15, production runbook validation (OPS-24).
**Exit criteria**: QA-15 §9 exit criteria met; MDG-00 §22 release checklist signed off by Product
Owner.

## Phase 6 — Intelligence (Post-MVP)

**Goal**: Personalization built on real usage data.
**Scope**: Recommendation engine, adaptive study plans, weak-topic detection, mentor intervention
alerts, advanced BI/analytics warehouse.
**Key docs**: AI-28, ANALYTICS-12 §10.
**Note**: Deliberately sequenced after Phase 1-5 collect enough real learner activity data to make
recommendations meaningful; starting this earlier would mean building against synthetic assumptions.
Planned as its own roadmap/sprint cycle once Phase 1-5 are in production.

## Cross-Cutting Workstreams (every phase)

- Security/RBAC/audit logging (SEC-13) — enforced per-feature, not retrofitted
- Observability (Prometheus/Grafana/Loki/OTel/Sentry) — wired in Sprint 0, extended per service
- Accessibility (WCAG 2.1 AA) — every UI component from DS-18 onward
- Data governance/consent (DATA-27) — every PII-touching feature
- Testing (QA-15 levels) — unit/integration/API tests required before a sprint is marked done
