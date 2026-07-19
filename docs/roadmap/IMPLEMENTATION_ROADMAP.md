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

## Phase 1 — MVP: Core Learning & Assessment (Sprints 1-5)

**Goal**: A student can register, enroll, learn, and take a scored quiz.
**Scope**: Full RBAC, course/subject/topic/module CMS + delivery, progress tracking, quiz engine
(configuration, attempt lifecycle, autosave, scoring, reports, question reporting), basic admin CMS.
**Key docs**: SRS-02 FR-AUTH/PROFILE/COURSE/CONTENT/PROGRESS/QUIZ/REPORT, ASSESS-09, DB-05/16/34,
API-17.
**Exit criteria**: All Phase 1 FR-IDs in SRS-02 Table 3 have passing automated tests; a full
register → enroll → learn → quiz → report journey works end-to-end in staging.

## Phase 2 — Mentor-Led Learning (Sprints 6-8)

**Goal**: Creative submissions and human mentoring close the feedback loop.
**Scope**: Creative assignment authoring/submission/upload validation/malware scan, rubric review
workspace with annotations (private, pre-community), cohorts, mentor dashboard, Student 360, task
assignment, merged notification service (COMM-MERGED) going live on real channels.
**Key docs**: CREATIVE-10, DESIGN-03, COMM-MERGED, SRS-02 FR-ASSIGN/REVIEW/MENTOR.
**Exit criteria**: A mentor can review a real submission end-to-end (annotate, score, publish
feedback, request revision) with full audit trail; notification delivery SLA ≥98% in staging load
test.

## Phase 3 — Creative Community (Sprint 9)

**Goal**: Safe peer learning.
**Scope**: Revision cycles, XP/achievements with anti-fraud idempotency, consent-gated community
gallery, peer rating, moderation tooling (report/hide/restore/warn/audit).
**Key docs**: CREATIVE-10 §8-10, SRS-02 FR-COMM-01/02, doc 08 §Community Moderation.
**Exit criteria**: Private-by-default enforced with tests; moderator can hide reported content within
SLA; XP cannot be awarded twice for the same action (idempotency test).

## Phase 4 — Growth & Counselling (Sprints 10-12)

**Goal**: Monetization and acquisition.
**Scope**: Razorpay payment orders/webhooks/entitlements/invoices, articles, events/webinars,
college directory, consented enquiries, full admin (question-bank approval workflow, payments admin,
analytics dashboards, moderation escalation).
**Key docs**: SRS-02 FR-PAY/EVENT/COLLEGE/ENQ, ADMIN-08, ANALYTICS-12.
**Exit criteria**: Webhook signature verification tested against forged/duplicate events; entitlement
granted only from verified webhook, never client callback; admin can complete every workflow listed
in ADMIN-08 §5.

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
