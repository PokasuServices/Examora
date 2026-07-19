# Examora Platform — Sprint Backlog

Status: Baseline approved 2026-07-18 (supersedes AGILE-20's 6-sprint plan per ADR-0003).
Cadence: 2-week sprints. Sprint 0 (infrastructure) precedes Sprint 1.
Definition of Ready / Definition of Done: see `docs/DEVELOPMENT_CHECKLIST.md`.

Each sprint lists: focus, backlog items with source FR/doc IDs, and exit criteria. Maintain this
file as sprints complete — move finished items to a "Completed" note at the top of the sprint
section rather than deleting them, so the backlog stays a historical record.

---

## Sprint 0 — Infrastructure & Project Setup

Status: **In progress**
Backlog: monorepo scaffold, Docker Compose (Postgres/Redis/MinIO), CI pipeline, ESLint/Prettier/
Husky/Commitlint/Changesets, Prisma baseline (identity/audit tables only), base NestJS app
(config/logging/health/Swagger), base Next.js apps (web/admin), basic auth skeleton (register/
login/refresh/logout, no business features).
No business FR-IDs in scope. See `docs/DEVELOPMENT_CHECKLIST.md` Sprint 0 checklist for exit criteria.

## Sprint 1 — Authentication, Profiles, RBAC

Status: **Complete** (2026-07-18). 63 automated tests pass (27 unit/integration + 36 e2e).

Delivered:

- FR-AUTH-01, FR-AUTH-02: email/password auth, email verification, forgot/reset password, refresh
  rotation, session management, OAuth (Google, config-gated), server-side RBAC + permission checks
  on every endpoint, audit logging on all sensitive actions
- FR-PROFILE-01: profile GET/PUT + consent capture (version/channel/timestamp/actor), with an
  append-only ConsentRecord trail
- DESIGN-03 §2-3: full role set seeded + a permissions framework (`@RequirePermissions` +
  PermissionsGuard, seeded role→permission matrix) — see ADR-0010
- Admin user management: list, role assignment, status (suspend/reactivate revokes sessions),
  audit-log viewing
- Frontend: apps/web (login, register, forgot/reset password, verify email, profile with session
  management, OAuth callback) and apps/admin (login, users list, user detail) via a shared
  `@examora/auth-client` package (ADR-0011)

Scope boundaries held: no Course/Learning/Quiz/Assignment/Payment/Notification/CMS/Analytics/AI/
Community functionality. Email sending is a Sprint-1 console stub behind a port interface (ADR-0009);
the real Notification Service remains Sprint 9.

Exit criteria met: RBAC matrix green (student denied admin routes; admin allowed; permission checks
enforced), consent captured + audited, no endpoint reachable without a passing authorization check
(deny-by-default global JwtAuthGuard).

## Sprint 2 — Course Management (content hierarchy)

Status: **Complete** (2026-07-19). 111 automated tests pass (54 unit/integration + 51 e2e + 6 utils).

Delivered:

- FR-CONTENT-01: full `Category > Course > Subject > Topic > Module > Lesson` hierarchy (ADR-0012);
  admin create / draft / publish / unpublish / archive / restore + reorder (dedicated reorder
  endpoints per collection); ordering via `position`
- Course status workflow DRAFT → PUBLISHED → ARCHIVED with server-enforced transitions and
  `publishedAt` stamping (uniform 3-state status on every learning-content node)
- Full CRUD REST APIs (35 content routes) for all six resources, with RBAC (`content:manage` /
  `content:publish`), request validation (422), audit logging on every mutation, and Swagger docs
- Admin UI: categories management, courses list (status filter + create), and a course-detail page
  with a nested Subject→Topic→Module→Lesson tree editor (create/status/delete/expand)
- Prisma migration `sprint2_content_hierarchy`; content permission codes seeded to ADMINISTRATOR

Scope boundaries held: no enrollment, learning progress, quizzes, assignments, payments,
notifications, analytics, AI, community, or student-facing read APIs. Content versioning /
revision-history (CMS-29 §5) and the IN_REVIEW/APPROVED workflow states (CMS-29 §4) are **deferred**
(out of Sprint 2 scope) — see ADR-0012 and the technical debt register (TD-017). FR-CONTENT-02's
content _rendering/delivery_ and completion tracking are a later sprint; Sprint 2 authors and stores
the hierarchy only.

**Exit criteria met**: an admin authored and published a full course tree end-to-end (browser +
API smoke tests); RBAC denies non-admins; invalid status transitions and duplicate slugs are
rejected; every mutation is audited.

## Sprint 3 — Progress Tracking + Student Dashboard

- FR-PROGRESS-01: module completion, video progress, last access, time spent, topic coverage
- UX-07 Student Dashboard: progress, continue learning, upcoming tasks, recent scores, notifications
- Syllabus heatmap / coverage chart (PRD-01 §6.1) — functional pattern reference only, original
  visual design per ADR-0008

**Exit criteria**: Dashboard shows only the logged-in student's own computed progress (data isolation
tested); no cross-student leakage.

## Sprint 4 — Quiz Engine: Configuration & Attempt Lifecycle

- FR-QUIZ-01: question pool, marks, negative marking, duration, attempt limit, availability,
  randomization, result-release policy; attempt-start rejected when policy unmet
- FR-QUIZ-02: autosave, progress display, flagging, idempotent final submission; refresh/reconnect
  restores latest saved attempt
- FR-QUIZ-03: answer-approach capture (Knowledge/Formula, Elimination, Random Choice)
- BR-03: published question/version snapshotted into the attempt at start (immutability)
- ASSESS-09 §8: anti-cheating (randomization, option shuffling, session timeout, duplicate-submission
  prevention)

**Exit criteria**: Idempotent submit verified under simulated double-submit/network-retry; attempt
snapshot immutable even if the source question is later edited.

## Sprint 5 — Scoring, Reports & Recommendations v0

- FR-QUIZ-04: automatic objective scoring per published rules, audit timestamp, persisted once
- FR-QUIZ-05: question reporting (student flags a faulty question without affecting their result)
- FR-REPORT-01: score, accuracy, time, answer approach, topic performance, question review;
  completed-attempt snapshot stable even if questions are later edited
- FR-REC-01: next-step recommendations from mastery/recency/results/weightage, each with a stored,
  reproducible reason (no black-box output yet — full AI engine is Phase 6)

**Exit criteria**: Phase 1 (MVP) complete — full register→enroll→learn→quiz→report journey passes
E2E; all Phase 1 FR-IDs have automated test evidence per QA-15 §10.

## Sprint 6 — Creative Assignment Authoring & Submission

- FR-ASSIGN-01: brief, references, file rules, marks, rubric, deadline
- FR-ASSIGN-02: signed upload, submission versioning per resubmission, type/size validation,
  malware scan before reviewer access (ClamAV per ADR-0005)
- CREATIVE-10 §2-4: assignment lifecycle through "reviewer allocation," submission workflow

**Exit criteria**: Unsupported/oversized files rejected client- and server-side; infected file
never reaches reviewer or storage in a scanned state.

## Sprint 7 — Rubric Review Workspace & Annotations

- FR-REVIEW-01: self/peer/faculty review per assignment policy; criterion ratings, comments,
  publish/reject
- FR-REVIEW-02: positional image annotations, coordinates stored relative to original image,
  responsive scaling
- CREATIVE-10 §6-7: weighted rubric scoring, mandatory feedback on low scores, rubric versioning

**Exit criteria**: A reviewer can complete a full rubric evaluation with annotations on a real
submission; grading history immutable and audited.

## Sprint 8 — Mentoring: Cohorts, Dashboard, Student 360, Tasks

- FR-MENTOR-01: mentor dashboard — assigned workload, reviews, doubts, sessions, at-risk alerts; no
  unassigned student in default queries
- FR-MENTOR-02: Student 360 (progress, activity, results, submissions, tasks, internal notes);
  internal notes never visible to students/guardians; every access audited
- FR-MENTOR-03: task assignment with due dates/resources/feedback; student notified
- DESIGN-03 §4: full mentor lifecycle (assignment → dashboard → review → task → escalation)

**Exit criteria**: Phase 2 core complete — mentor can execute the full DESIGN-03 §4 lifecycle
end-to-end against real cohort data; access-scoping tests (mentor sees only assigned students) green.

## Sprint 9 — Notifications, Messaging & Community

- COMM-MERGED (supersedes COMM-11/COMM-31 per ADR-0004): full delivery workflow live on real
  channels (Email/SMS/WhatsApp/Web Push/In-App), DLQ + fallback, delivery-state tracking
- CREATIVE-10 §8-10: revision cycles, community gallery (consent-gated, private by default), peer
  rating, XP/achievement idempotency
- FR-COMM-01/02: scoped discussions, gallery visibility, moderation (report/hide/restore/warn/audit)

**Exit criteria**: Phase 3 complete — delivery success ≥98% in staging load test; XP double-award
prevented under concurrent-request test; moderator can hide reported content within SLA.

## Sprint 10 — Payments & Entitlements

- FR-PAY-01: Razorpay order creation, webhook-verified entitlement (never trust client callback),
  duplicate/forged webhook does not create duplicate access
- Commerce data model: plans, orders, payments, invoices, entitlements (DB-05 §3)
- SRS-02 Table 6: webhook signature verification server-side, mandatory

**Exit criteria**: Forged/duplicate webhook test suite passes; entitlement grant/revoke fully
audited; invoice generation correct under refund/partial-refund scenarios.

## Sprint 11 — Growth Modules & Full Admin

- FR-EVENT-01: webinar/event scheduling, registration (deduplicated by user+event), attendance
- FR-COLLEGE-01: college directory search/filter/detail, published-only data
- FR-ENQ-01: consented enquiry sharing with colleges, consent version/time stored
- ADMIN-08 §4-5: remaining admin modules (question-bank approval workflow, payments admin, community
  moderation admin, system settings/feature flags) and their workflows

**Exit criteria**: Every ADMIN-08 §5 workflow completes end-to-end; consent stored/verified before
any student contact data is shared externally.

## Sprint 12 — Analytics & Reporting

- ANALYTICS-12 §2-7: role-scoped dashboards (student/mentor/admin), learning/assessment/creative
  analytics, business + operational reports
- ANALYTICS-12 §8, §10: CSV/PDF export, scheduled reports, ETL-ready/star-schema-compatible
  reporting tables (foundation for Phase 6, not full BI yet)
- Raw-SQL views/materialized views per ADR-0007, justified per DB-34 §6

**Exit criteria**: Phase 4 complete — every dashboard/report in ANALYTICS-12 renders real data with
role-based access enforced; PII masked in exports where required.

## Sprint 13 — Stabilization & Release Readiness

- PERF-32: load/stress/spike/soak testing against target SLAs (API p95 <500ms, LCP <2.5s,
  availability >99.9%)
- SEC-13: full security review, OWASP Top 10 pass, penetration test findings closed
- WCAG 2.1 AA accessibility audit across all three apps
- QA-15: full regression pass, UAT sign-off, exit criteria met
- OPS-24: production runbooks validated, monitoring/alerting live, backup/restore tested

**Exit criteria**: MDG-00 §22 release checklist fully signed off by Product Owner. Phase 5 complete.

---

## Post-MVP: Phase 6 (Intelligence)

Not sprint-planned yet — deliberately deferred until Phase 1-5 are in production and generating
real usage data (see `IMPLEMENTATION_ROADMAP.md` Phase 6 note). Re-plan as its own sprint cycle
when scheduled.
