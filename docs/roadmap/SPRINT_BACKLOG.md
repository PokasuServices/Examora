# Examora Platform — Sprint Backlog

Status: Baseline approved 2026-07-18 (supersedes AGILE-20's 6-sprint plan per ADR-0003).
Cadence: 2-week sprints. Sprint 0 (infrastructure) precedes Sprint 1.
Definition of Ready / Definition of Done: see `docs/DEVELOPMENT_CHECKLIST.md`.

Each sprint lists: focus, backlog items with source FR/doc IDs, and exit criteria. Maintain this
file as sprints complete — move finished items to a "Completed" note at the top of the sprint
section rather than deleting them, so the backlog stays a historical record.

---

## Sprint 0 — Infrastructure & Project Setup

Status: **Complete** (2026-07-18).
Backlog: monorepo scaffold, Docker Compose (Postgres/Redis/MinIO), CI pipeline, ESLint/Prettier/
Husky/Commitlint/Changesets, Prisma baseline (identity/audit tables only), base NestJS app
(config/logging/health/Swagger), base Next.js apps (web/admin), basic auth skeleton (register/
login/refresh/logout, no business features).
No business FR-IDs in scope. All exit-criteria items in `docs/DEVELOPMENT_CHECKLIST.md` Sprint 0
checklist met (build/lint/typecheck/docker/health/Swagger/register-login-refresh-logout/CI all green).

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
the real Notification Service remains Sprint 8 (renumbered after the Sprint 5 resequencing; was
Sprint 9 at the time).

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

## Sprint 3 — Learning Engine (student learning + progress)

Status: **Complete** (2026-07-20). 138 automated tests pass (69 unit/integration + 63 e2e + 6 utils).

Delivered:

- Student catalog: browse PUBLISHED courses, read a course's published curriculum, open a lesson —
  published-chain visibility enforced (a lesson is only reachable when it and every ancestor is
  PUBLISHED; otherwise 404) (ADR-0013)
- FR-PROGRESS-01: per-lesson view + completion tracking (`LessonProgress`), derived per-course
  completion %, "continue learning" (started-but-unfinished courses with the next lesson),
  "recently viewed", and a student learning dashboard
- Admin read-only progress dashboard: per-course learner/completion aggregates (progress:read)
- RBAC (content:read for students, progress:read for the admin dashboard; own-progress endpoints
  self-scoped), request validation, audit logging of lesson completions, Prisma migration, Swagger
- Frontend: apps/web course catalog, course/curriculum page, lesson viewer (records view + mark
  complete), learning dashboard; apps/admin read-only progress dashboard

Scope boundaries held: **no enrollment/entitlement gate** (any authenticated student learns any
published course — ADR-0013; entitlement is a commerce concern for a later sprint), and no
Quiz/Assignment/Payment/Community/Notification/Analytics/AI/Mentor/CMS-enhancement work. Completion
is an explicit student action; FR-CONTENT-02's "completion condition" config is deferred (TD-019).

Bug fixed along the way: a latent Sprint-2 boolean-query-param coercion bug (`?isActive=false`
inverted by the global ValidationPipe) — fixed with a regression guard (see technical debt register).

**Exit criteria met**: dashboard/progress endpoints are self-scoped to the caller (no cross-student
leakage — e2e verified); draft/unpublished content is invisible to students; completions audited.

## Sprint 4 — Assessment & Quiz Engine

Status: **Complete** (2026-07-21). 216 automated tests pass (120 unit/integration + 87 e2e + 9 utils).

Delivered:

- FR-QUIZ-01: question bank (SINGLE_CHOICE/MULTIPLE_CHOICE/TRUE_FALSE, difficulty, tags, explanation,
  subject classification reusing the Sprint 2 curriculum taxonomy) and quiz authoring (sections,
  per-assignment marks, time limit, passing score, negative marking, question/option shuffling,
  DRAFT→PUBLISHED→ARCHIVED via the shared ContentStatus, with a publish gate requiring ≥1 assigned
  question and every assigned question PUBLISHED) — ADR-0014
- FR-QUIZ-02: start/resume, per-question autosave, idempotent submit, auto-submit-on-timeout
  (access-triggered), attempt history; every attempt freezes its own question order, option order,
  marks and marking rules at start so later quiz/question edits never retroactively change an
  attempt already underway or submitted
- Automatic scoring: all-or-nothing per question, unanswered never penalized, negative marking
  applied only to attempted-and-wrong answers, pass/fail against the frozen passing threshold,
  result summary + detailed per-question review with explanations
- BR-03 (attempt immutability): question/option identity plus composition/marks/shuffle order is
  frozen at attempt start (`questionSnapshot`/`optionOrder`); correctness is graded once, live, at
  submission and then permanently fixed — a later question edit never rescoring a submitted attempt
- ASSESS-09 §8 anti-cheating/reliability: shuffling frozen per attempt, session timeout via
  access-triggered auto-submit, duplicate-submission prevention via an optimistic-lock-guarded
  transaction (verified under 8-way concurrent submit calls: exactly one scoring pass, one version
  increment, identical result returned to every caller)
- Bulk-import foundation (`POST .../questions/bulk`, schema + transactional endpoint only — no
  CSV/file pipeline this sprint, TD-022)
- Admin: question bank + quiz authoring UI (sections, question assignment, publish gating), attempt
  monitoring (list/detail, `effectivelyExpired` flag for stale-but-unaccessed expired attempts), a
  per-quiz result dashboard (attempts, completion, pass rate, average/high/low score)
- Student (apps/web): quiz catalog, quiz detail (metadata + sections, no question content before
  starting), timed attempt-taking UI (autosave, countdown, auto-submit), result summary, detailed
  review, per-quiz attempt history
- RBAC (`question:manage`, `quiz:manage`, `quiz:publish`, `quiz:read` baseline, `quiz:attempts:read`
  admin), validation, audit logging, soft deletes, optimistic locking (`QuizAttempt.version`),
  Swagger, Prisma migration `sprint4_quiz_engine`
- Bug fix (allowed): `ensureRolesAndPermissions` e2e test helper only wired ADMINISTRATOR, silently
  depending on a prior `db:seed` run for non-admin baseline permissions — would 403 on a genuinely
  fresh CI database. Fixed by extracting `BASELINE_PERMISSION_CODES` as the shared source of truth
  for both `database/prisma/seed.ts` and the test helper.

Scope boundaries held: no Creative Assignments/Mentoring/Community/Notifications/Payments/
Analytics/AI/CMS-enhancement work. Question categorization reuses the existing Subject taxonomy and
tags are a flat array rather than new normalized entities (ADR-0014) — deliberate scope reduction,
not a gap. Note: this backlog entry originally also listed FR-QUIZ-03 (capturing whether a student's
answer approach was Knowledge/Formula, Elimination, or Random Choice) from the pre-Sprint-4 planning
draft; the actual Sprint 4 kickoff scope instruction did not include it, so it was not built — it
remains open for a future sprint if still wanted.

**Exit criteria met**: idempotent submit verified under real concurrent (8-way parallel) submit
calls, not just simulated; attempt snapshot immutable even when the source question/quiz is edited
after the attempt starts (integration-tested); a 500-question quiz starts/autosaves/scores correctly
within the same request-time budget as a small quiz (performance-validated, not just asserted).

## Sprint 5 — Creative Assignment Engine

Status: **Complete** (2026-07-21). 270 automated tests pass (152 unit/integration + 109 e2e +
9 utils).

Resequencing note (approved ahead of Sprint 5): this entry merges what the original plan split
across two sprints — "Creative Assignment Authoring & Submission" and "Rubric Review Workspace &
Annotations" — into one end-to-end vertical slice (author → submit → assign reviewer → rubric
review → marks → history), per the approved Sprint 5 kickoff scope. "Scoring, Reports &
Recommendations v0" (the original Sprint 5, closing out Phase 1) is renumbered to Sprint 6 — see
`docs/roadmap/IMPLEMENTATION_ROADMAP.md` Phase 1/2 for why. Everything from Sprint 6 onward in the
original plan shifts down by one sprint number accordingly.

Delivered:

- FR-ASSIGN-01: brief, references, file rules, marks, rubric, deadline; assignment templates
  (title/brief/fileRules/marksTotal/rubric skeleton, copied — not live-linked — into a new
  assignment at creation time so later template edits never retroactively change an assignment
  already created from it) — ADR-0015
- FR-ASSIGN-02: presigned direct-to-storage upload (S3-compatible/MinIO), submission versioning
  per resubmission (each resubmission is a new row, mirroring the QuizAttempt precedent from
  ADR-0014), type/size validation against the assignment's file rules, quarantine-by-default
  malware scanning (ClamAV via BullMQ, files start PENDING and are only ever downloadable once
  CLEAN; INFECTED files are deleted from storage immediately) — ADR-0005, ADR-0015
- CREATIVE-10 §2-4: assignment lifecycle (DRAFT→PUBLISHED→ARCHIVED via the shared ContentStatus,
  publish gated on ≥1 rubric criterion) through reviewer allocation (admin assigns/reassigns any
  MENTOR/REVIEWER-role user) and the 5-state submission workflow (DRAFT/SUBMITTED/UNDER_REVIEW/
  REVISION_REQUESTED/APPROVED)
- FR-REVIEW-01: rubric-based review — per-criterion marks + comment, overall comment, draft-then-
  publish workflow (a draft review is never visible to the student; publishing records the
  APPROVED/REVISION_REQUESTED decision, sums obtained marks, and closes out the submission)
- CREATIVE-10 §6: weighted rubric scoring (marks per criterion, summed on publish), flat threaded
  comments visible to the student and assigned reviewer
- Reviewer dashboard (assigned-submission queue, filterable by status) and student assignment
  history (all versions across all assignments, filterable by assignment)
- Admin: assignment + template CRUD, rubric authoring, publish gating, submission monitoring
  (filter by assignment/reviewer/status, reviewer assign/reassign), reviewer scoring workspace —
  apps/admin/src/app/assignments/**
- Student (apps/web): assignment catalog, detail + start/resume, draft editing + file upload +
  notes + final submit, awaiting-review/decided views with resubmit, comment thread, submission
  history — apps/web/src/app/assignments/**
- RBAC (`assignment:manage`, `assignment:publish`, `assignment:read` baseline, `assignment:review`
  — new `REVIEWER_PERMISSION_CODES` group for MENTOR/REVIEWER), validation, audit logging,
  Prisma migration `20260721091804_sprint5_creative_assignment_engine`, Swagger,
  unit/integration/e2e tests
- Bug fixes (allowed, all caught by e2e/browser testing before merge, none shipped):
  ClamAV's background init used a fire-and-forget promise with no `.catch()` — with
  `MalwareScanModule` global and now wired into `AppModule`, an unreachable clamd crashed the
  entire process via an unhandled rejection on every e2e spec, not just this sprint's. Fixed with
  `.catch()` + logging and clearing the cached init promise on failure so a later scan retries
  fresh (TD-024 records the underlying pattern). Separately, `BullModule.forRootAsync` created its
  own untracked inline Redis connection with no shutdown hook, leaving Jest hanging after
  `app.close()`; fixed by giving BullMQ a dedicated, DI-managed `BULLMQ_REDIS_CLIENT` that
  `RedisShutdownService` closes alongside the general-purpose connection. `ListHistoryQueryDto`'s
  `assignmentId` query param had no class-validator decorators, so the global
  `whitelist`/`forbidNonWhitelisted` pipe rejected it outright; and `admin/assignments/:id`'s
  dynamic route was registered before `admin/assignments/submissions`, so Express matched
  "submissions" as an `:id` — fixed by adding the missing decorators and reordering controller
  registration (TD-025). A manual browser pass over the new admin pages (no prior automated
  coverage of admin UI) also caught two client-only bugs: decimal marks inputs (`min={0.01}`) had
  no `step`, so the browser's native numeric-step validation silently blocked form submission; and
  the reviewer-picker dropdown requested `pageSize=200` against an endpoint capped at 100.

Deferred (not in this sprint's approved scope): FR-REVIEW-02 positional image annotations
(CREATIVE-10 §7 — coordinates stored relative to the original image, responsive scaling). Rubric
review ships with structured criterion ratings + freeform comments but no annotation canvas; revisit
in a later review-UX polish pass.

**Exit criteria met**: unsupported/oversized files rejected client- and server-side; an infected
file (EICAR test string) is quarantined and never resolves a download URL; a reviewer completed a
full rubric evaluation (score every criterion, publish an APPROVED decision) against a real
submission, verified both via e2e and a live browser pass; grading history immutable and audited.

## Sprint 6 — Scoring, Reports & Recommendations v0

- FR-QUIZ-04: automatic objective scoring per published rules, audit timestamp, persisted once
- FR-QUIZ-05: question reporting (student flags a faulty question without affecting their result)
- FR-REPORT-01: score, accuracy, time, answer approach, topic performance, question review;
  completed-attempt snapshot stable even if questions are later edited
- FR-REC-01: next-step recommendations from mastery/recency/results/weightage, each with a stored,
  reproducible reason (no black-box output yet — full AI engine is Phase 6)

**Exit criteria**: Phase 1 (MVP) complete — full register→enroll→learn→quiz→report journey passes
E2E; all Phase 1 FR-IDs have automated test evidence per QA-15 §10.

## Sprint 7 — Mentoring: Cohorts, Dashboard, Student 360, Tasks

- FR-MENTOR-01: mentor dashboard — assigned workload, reviews, doubts, sessions, at-risk alerts; no
  unassigned student in default queries
- FR-MENTOR-02: Student 360 (progress, activity, results, submissions, tasks, internal notes);
  internal notes never visible to students/guardians; every access audited
- FR-MENTOR-03: task assignment with due dates/resources/feedback; student notified
- DESIGN-03 §4: full mentor lifecycle (assignment → dashboard → review → task → escalation)

**Exit criteria**: Phase 2 core complete — mentor can execute the full DESIGN-03 §4 lifecycle
end-to-end against real cohort data; access-scoping tests (mentor sees only assigned students) green.

## Sprint 8 — Notifications, Messaging & Community

- COMM-MERGED (supersedes COMM-11/COMM-31 per ADR-0004): full delivery workflow live on real
  channels (Email/SMS/WhatsApp/Web Push/In-App), DLQ + fallback, delivery-state tracking
- CREATIVE-10 §8-10: revision cycles, community gallery (consent-gated, private by default), peer
  rating, XP/achievement idempotency
- FR-COMM-01/02: scoped discussions, gallery visibility, moderation (report/hide/restore/warn/audit)

**Exit criteria**: Phase 3 complete — delivery success ≥98% in staging load test; XP double-award
prevented under concurrent-request test; moderator can hide reported content within SLA.

## Sprint 9 — Payments & Entitlements

- FR-PAY-01: Razorpay order creation, webhook-verified entitlement (never trust client callback),
  duplicate/forged webhook does not create duplicate access
- Commerce data model: plans, orders, payments, invoices, entitlements (DB-05 §3)
- SRS-02 Table 6: webhook signature verification server-side, mandatory

**Exit criteria**: Forged/duplicate webhook test suite passes; entitlement grant/revoke fully
audited; invoice generation correct under refund/partial-refund scenarios.

## Sprint 10 — Growth Modules & Full Admin

- FR-EVENT-01: webinar/event scheduling, registration (deduplicated by user+event), attendance
- FR-COLLEGE-01: college directory search/filter/detail, published-only data
- FR-ENQ-01: consented enquiry sharing with colleges, consent version/time stored
- ADMIN-08 §4-5: remaining admin modules (question-bank approval workflow, payments admin, community
  moderation admin, system settings/feature flags) and their workflows

**Exit criteria**: Every ADMIN-08 §5 workflow completes end-to-end; consent stored/verified before
any student contact data is shared externally.

## Sprint 11 — Analytics & Reporting

- ANALYTICS-12 §2-7: role-scoped dashboards (student/mentor/admin), learning/assessment/creative
  analytics, business + operational reports
- ANALYTICS-12 §8, §10: CSV/PDF export, scheduled reports, ETL-ready/star-schema-compatible
  reporting tables (foundation for Phase 6, not full BI yet)
- Raw-SQL views/materialized views per ADR-0007, justified per DB-34 §6

**Exit criteria**: Phase 4 complete — every dashboard/report in ANALYTICS-12 renders real data with
role-based access enforced; PII masked in exports where required.

## Sprint 12 — Stabilization & Release Readiness

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
