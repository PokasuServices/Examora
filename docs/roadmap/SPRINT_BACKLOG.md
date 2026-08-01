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
the real Notification Service remains Sprint 10 (renumbered after the Sprint 8 resequencing; was
Sprint 9 after the Sprint 7 resequencing, Sprint 8 before that, and Sprint 9 before the Sprint 5
resequencing).

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

## Sprint 6 — Mentor Management

Status: **Complete** (2026-07-22). 319 automated tests pass (180 unit/integration + 130 e2e + 9
utils).

Resequencing note (approved ahead of Sprint 6, mirroring the Sprint 5 precedent): this entry runs
what was previously planned as Sprint 7 ("Mentoring: Cohorts, Dashboard, Student 360, Tasks") ahead
of "Scoring, Reports & Recommendations v0" (previously Sprint 6, now Sprint 7) — see
`docs/roadmap/IMPLEMENTATION_ROADMAP.md` Phase 1/2 for why. No functional dependency blocks this:
Mentor Management operates on the existing Learning/Assessment/Assignment data, independent of the
quiz engine's own scoring/reports/recommendations feature. Scope is also narrower than the original
Sprint 7 planning note: **Cohorts and at-risk-alert escalation are not part of this sprint's
approved scope** (see Deferred below) — the approved scope is Mentor Management, Student 360, and
the Mentor Workflow (notes/tasks/feedback/meetings/progress-quiz-assignment review), reusing the
existing Sprint 5 reviewer workflow for assignment review rather than rebuilding it.

Delivered:

- Mentor Management: mentor CRUD (admin creates/edits/deletes a mentor profile extending an
  existing MENTOR-role user — bio, specialization, workload capacity), mentor assignment
  (admin assigns/reassigns a student to a mentor via a history-preserving join table — reassigning
  supersedes rather than deletes the previous row), workload (active-student-count vs. capacity,
  computed on read, never stored)
- Student 360: student profile, learning progress, quiz history, assignment history, activity
  timeline (a merge-and-sort over lesson completions, quiz attempts, assignment submissions, and
  mentor notes/tasks/feedback/meetings) — a read-only aggregator composed entirely from Sprint
  3/4/5's existing `ProgressService`, `AdminQuizAttemptsService`, `SubmissionsService`, and
  `UsersService` (ADR-0016) — each already accepted a target-user id, so no new progress/scoring/
  submission query logic was written, only a new `exports:` entry on each owning module
- Mentor Workflow: the mentor's own dashboard (caseload, pending tasks, recent meetings), notes
  (private, never visible to the student), tasks (with due dates and a PENDING/IN_PROGRESS/
  COMPLETED status), feedback, meeting history, and progress/quiz/assignment review via Student
  360 and Sprint 5's existing reviewer workflow — no new review write path was built
- Admin: mentor management, mentor assignment, mentor workload, and an admin mentor dashboard
  (every mentor's utilization, for capacity planning) — `apps/admin/src/app/mentors/**`,
  `apps/admin/src/app/mentor-dashboard`, `apps/admin/src/app/students/[id]`
- A server-side `role` filter added to the existing `GET /admin/users` endpoint (`UsersService.list`)
  for the mentor/student pickers — previously this filtering was done client-side only, over-fetching
  every user on every admin assignment page
- FR-MENTOR-01/02/03, DESIGN-03 §4 (assignment → dashboard → review → task lifecycle; escalation
  deferred)
- RBAC: `mentor:manage` (ADMINISTRATOR only) and a new `mentor:workflow` permission on MENTOR only —
  the first sprint where MENTOR and REVIEWER permissions diverge (previously identical). Every
  mentor-workflow endpoint is gated by `mentor:workflow` alone (ADMINISTRATOR already holds every
  permission code, so admin oversight passes the same gate); ownership — the actor is the student's
  currently assigned mentor, or an admin — is enforced in the service layer via
  `MentorAssignmentService.assertAssignedOrAdmin`, verified by e2e (a non-assigned mentor is
  denied; an admin is not)
- Validation, audit logging (`mentoring.mentor_assigned`, `mentoring.note_created`,
  `mentoring.task_created`, etc.), Prisma migration `20260722101659_sprint6_mentor_management`,
  Swagger, unit/integration/e2e tests

Deferred (not in this sprint's approved scope, per the kickoff instruction): Community, Payments,
Notifications, Analytics, AI, further CMS enhancements. Also deferred from the original Sprint 7
planning note: cohort grouping/management and "at-risk" alerting/escalation — the mentor dashboard
this sprint shows assigned students and workload but does not compute an at-risk score or send
escalations (no notification service exists yet — TD-013; tracked as TD-028).

**Exit criteria met**: a mentor executed the full lifecycle end-to-end against real data (assigned →
dashboard → Student 360 review → note/task/feedback added → meeting logged), verified both by e2e
and a live browser pass with zero client-only bugs found; access-scoping enforced and tested — a
non-assigned mentor is denied Student 360/notes/tasks/feedback/meetings (403), a plain REVIEWER
(not MENTOR) is denied the mentor-workflow routes entirely, and an admin can access any student's
data regardless of assignment.

## Sprint 7 — Community & Discussion Module

Status: **Complete** (2026-07-22). 374 automated tests pass (217 unit/integration + 157 e2e),
including 64 new Sprint 7 tests (37 unit/integration + 27 e2e). See ADR-0017 for the full design
(Thread/Reply unification, polymorphic-lite likes/reports, reputation foundation, moderation, and
the duplicated attachment-scan queue).

Resequencing note (approved ahead of Sprint 7, mirroring the Sprint 5/6 precedent): this entry
splits the discussion/moderation half of what was previously bundled into Sprint 8 ("Notifications,
Messaging & Community") out into its own sprint, ahead of "Scoring, Reports & Recommendations v0"
(previously Sprint 7, then Sprint 8, now Sprint 9 after the Sprint 8 resequencing below). The
remaining half of old Sprint 8 — merged notification delivery (COMM-MERGED) and the creative
community gallery/peer-rating/XP (CREATIVE-10 §8-10) — is not part of this sprint's approved scope
and becomes Sprint 10 ("Notifications & Creative Gallery"; was Sprint 9 before the Sprint 8
resequencing). No functional dependency blocks this: discussion forums/doubt-resolution operate on
existing Auth/RBAC/Learning/Quiz/Assignment/Mentor data, independent of the quiz engine's
scoring/reports or the notification/gallery features.

- Discussion Forums: forum categories, discussion boards, topics, threads, replies (including
  nested replies), thread status (OPEN/CLOSED/PINNED/LOCKED)
- Doubt Resolution: ask/answer a question, accepted answer, solved/unsolved status, linking a
  question to related learning content (course/lesson/quiz/assignment)
- Community Features: comments, likes, bookmarks, follow a thread, a reputation foundation (points
  from accepted answers/likes received, no badges/levels yet), a community activity timeline
- Moderation: report content, moderate (hide/restore), delete/restore, lock/unlock threads,
  pin/unpin threads
- Search: search forums/questions/discussions with filters and pagination
- Attachments: image/document upload on posts, validated and quarantine-scanned exactly like
  Sprint 5's assignment file upload (reuses `StoragePort`/`MalwareScannerPort` as-is)
- FR-COMM-01/02 (the discussion/moderation half only — gallery/peer-rating/XP is Sprint 10 scope)
- RBAC, validation, audit logging, Prisma migrations, Swagger, unit/integration/e2e tests

Deferred (not in this sprint's approved scope, per the kickoff instruction): Notifications,
real-time chat, WebSockets, AI moderation, AI recommendations, payments, analytics, further CMS
enhancements. Also deferred: the creative community gallery, peer rating, and XP/achievements
(CREATIVE-10 §8-10) — these move to Sprint 10 alongside notification delivery, since neither was
part of this kickoff's explicit scope.

**Exit criteria**: A student can ask a question, receive answers, accept one, and see it marked
solved; a thread can be pinned/locked/closed by a moderator and access-scoping is enforced
(non-moderators cannot lock/pin/delete); search returns paginated, filtered results; an uploaded
attachment is quarantined until scanned clean, exactly like assignment file uploads.

## Sprint 8 — Commerce, Enrollment & Payments

Status: **Complete** (2026-07-23). 437 automated tests pass (251 unit/integration + 186 e2e),
including 63 new Sprint 8 tests (34 unit/integration + 29 e2e). See ADR-0018 for the full design
(EnrollmentModule as a new base-tier module to avoid a Learning/Assessment/Assignments ↔ Commerce
cycle, the PaymentGatewayPort/RazorpayGatewayService/FakePaymentGatewayService port-adapter split
mirroring ADR-0015, webhook-only entitlement grant, and the coupon/refund state machines).

Resequencing note (approved ahead of Sprint 8, mirroring the Sprint 5/6/7 precedent): this entry
runs Commerce/Enrollment/Payments now, absorbing the narrower "Payments & Entitlements" scope
previously planned as Sprint 10 (Razorpay orders/webhooks/entitlements/invoices) and adding
Enrollment (course enrollment/status/access-control/purchase-history — resolving TD-020's deferred
enrollment gate) and Commerce (pricing, coupons, discounts, refund-workflow foundation), none of
which were previously scoped in any sprint. Scoring/Reports/Recommendations v0 (previously Sprint 8)
moves to Sprint 9; Notifications & Creative Gallery (previously Sprint 9) moves to Sprint 10; Growth
Modules & Full Admin and Analytics & Reporting keep their sprint numbers (11, 12) since removing the
old Sprint 10 slot exactly offsets inserting this one — see D-53. No functional dependency blocks
this: enrollment/entitlement gating operates on the existing Learning/Assessment/Assignment/
Community services (adding an access check, not new business logic), independent of the quiz
engine's own scoring/reports or the notification/gallery features.

- Enrollment: course enrollment, enrollment status (active/expired/revoked), access-control gate on
  paid content, course entitlements, purchase history
- Commerce: pricing (per-course/plan), coupons, discounts, orders, invoices, a refund workflow
  foundation (request/approve/deny; full refund-to-gateway settlement is a later iteration)
- Payments: a gateway-agnostic payment abstraction (ADR-0005 already names Razorpay as the concrete
  adapter), payment verification (server-side webhook signature verification, mandatory — never
  trust a client callback), payment history, transaction logging
- FR-PAY-01: Razorpay order creation, webhook-verified entitlement, duplicate/forged webhook does
  not create duplicate access
- Commerce data model: plans, orders, payments, invoices, entitlements, coupons (DB-05 §3)
- SRS-02 Table 6: webhook signature verification server-side, mandatory
- Access control integration: Learning, Quiz Engine, Creative Assignments, and Mentor workflows all
  gate on entitlement — only entitled students access paid content
- Reuses existing Authentication, RBAC, User Management, Learning, Quiz, Assignments, Mentor, and
  Community services; does not duplicate their business logic

**Exit criteria**: Forged/duplicate webhook test suite passes; entitlement grant/revoke fully
audited; invoice generation correct under refund/partial-refund scenarios; a non-entitled student is
denied access to paid Learning/Quiz/Assignment/Mentor content, and an entitled student is not.

## Sprint 9 — Notification, Communication & Engagement

Status: **Complete** (2026-07-30). 500 automated tests pass (299 unit/integration + 201 e2e),
including 63 new Sprint 9 tests (48 unit/integration + 15 e2e). See ADR-0019 for the full design
(module shape, provider adapters, BullMQ delivery/schedule queues, delivery-state taxonomy,
transactional-bypass, DLQ + channel fallback, Notification/Delivery split).

Resequencing note (approved ahead of Sprint 9, mirroring the Sprint 5/6/7/8 precedent): this entry
runs the notification/communication half of old Sprint 10 ("Notifications & Creative Gallery") now,
ahead of Scoring/Reports/Recommendations v0 (previously Sprint 9, moves to Sprint 10). The other half
of old Sprint 10 — the creative community gallery, peer rating, and XP/achievements (CREATIVE-10
§8-10) — is not part of this sprint's approved scope and folds into Sprint 11 ("Growth Modules, Full
Admin & Creative Gallery") instead, alongside its existing growth/admin scope — see D-54. No
functional dependency blocks this: notification delivery is a cross-cutting concern that only needs
read access to existing Auth/Enrollment/Payments/Learning/Quiz/Assignment/Mentor/Community data to
fire events off of, independent of the quiz engine's own scoring/reports/recommendations feature or
the community gallery's media/rating/XP model.

- Notification Engine: Notification Service, Notification Templates, Notification Preferences,
  Notification Queue, Retry Policy, Delivery Tracking, Read/Unread, In-App Notifications
- Communication Channels: Email, Browser (Web) Push, SMS provider abstraction, WhatsApp provider
  abstraction, Mobile Push adapter interface (foundation only — no live integration, per ADR-0004)
- COMM-MERGED (supersedes COMM-11/COMM-31 per ADR-0004): full delivery workflow live on real
  channels (Email/SMS/WhatsApp/Web Push/In-App), DLQ + fallback-channel escalation, delivery-state
  tracking (`Queued → Sent → Delivered → Opened → Clicked → Acknowledged`, plus `Failed`/
  `Retried`/`Suppressed`)
- Event integration: Authentication (registration, email verification, password reset, security
  alert), Enrollment, Payments (success/refund), Learning/Quiz (reminders), Assignments (review
  published), Mentor (assignment), Community (reply, accepted answer, moderation action)
- Engagement: Notification Center, user preferences (channel opt-in/out, mute by category, DND
  schedule, digest vs. instant, language, timezone)
- Reliability: retry policy with backoff, dead-letter queue, channel fallback, delivery tracking,
  audit logging — maintaining the ≥98% delivery-success SLA (COMM-MERGED §11)
- Reuses existing Authentication, RBAC, Audit, Commerce, Assignment, Community, Mentor, Storage, and
  queue infrastructure (BullMQ/Redis, same pattern as the Sprint 5 malware-scan queue); replaces
  `ConsoleMailerService`/`MailerPort` (TD-013) wholesale — `AuthService` call sites do not change

**Exit criteria**: Delivery success ≥98% in staging load test; a forged/duplicate provider webhook
does not double-count delivery state; DLQ captures a message after exhausted retries; channel
fallback escalates on primary-channel failure; a muted/opted-out category is never delivered
(`Suppressed` state recorded); read/unread state is accurate in the notification center.

## Sprint 10 — Analytics & Reporting

Status: **Complete** (2026-07-31). 561 automated tests pass (337 unit/integration + 224 e2e),
including 61 new Sprint 10 tests (38 unit/integration + 23 e2e). See ADR-0020 for the full design
(module shape, permission model, report export/scheduled-report approach, page placement).

Resequencing note (approved ahead of Sprint 10, mirroring the Sprint 5/6/7/8/9 precedent — see
D-55): this entry runs ANALYTICS-12 (previously planned as Sprint 12) now, pulled forward ahead of
"Scoring, Reports & Recommendations v0" (previously Sprint 10, moves to Sprint 12 — a straight swap,
since Sprint 11's Growth Modules/Full Admin/Creative Gallery content is unaffected and sits
unchanged between them). No functional dependency blocks this: analytics/reporting is a read-only
aggregation layer over existing Auth/Course/Learning/Quiz/Assignment/Mentor/Community/Commerce/
Notification data, independent of the quiz engine's own per-attempt scoring/reports/recommendations
feature (FR-QUIZ-04/05, FR-REPORT-01, FR-REC-01) — Sprint 4 already shipped automatic scoring and
attempt monitoring, so the remaining old-Sprint-10 scope (question reporting, the individual
per-attempt report view, and the recommendation engine — itself explicitly out of scope for this
sprint) has no bearing on cross-user/cross-course analytics dashboards.

- Student Analytics: Learning Progress, Course Completion Reports, Quiz Performance, Assignment
  Performance, Learning Timeline, Activity Summary, Achievement Summary
- Mentor Analytics: Student Progress Dashboard, Student Performance Trends, Quiz Performance,
  Assignment Review Statistics, Mentor Workload, Student Engagement Summary
- Admin Analytics: Platform Dashboard, User Growth, Enrollment, Revenue, Course Performance, Mentor
  Performance, Community Analytics, Notification Delivery Analytics, Assignment Analytics, Quiz
  Analytics
- Reporting: Report Builder, date filters, CSV export, PDF export, Scheduled Reports (foundation
  only), aggregated statistics
- Visualization: dashboard cards, charts, trend graphs, tables, KPIs
- Reuses existing Authentication, Course Management, Learning Engine, Quiz Engine, Creative
  Assignment Engine, Mentor Management, Community, Commerce & Enrollment, and Notification modules
  — no duplicated business logic; a read-only aggregation layer per ADR-0007/DB-34 §6

**Exit criteria**: Every dashboard/report renders real data with role-based access enforced (a
student only ever sees their own analytics; a mentor only their assigned students'; admin-only
platform-wide views gated on the correct permission); CSV/PDF exports match the underlying
dashboard's figures; scheduled-report foundation proven end-to-end for at least one report type.

## Sprint 11 — AI Recommendation Engine

Status: **Complete** (2026-07-31). 595 automated tests pass (359 unit/integration + 236 e2e),
including 34 new Sprint 11 tests (22 unit/integration + 12 e2e). See ADR-0021 for the full design
(rule-based scoring, no external AI services, module shape, permission model, page placement).

Content note (see D-56): this kickoff explicitly redefined Sprint 11 to "AI Recommendation Engine,"
directing that the roadmap not otherwise be modified. The previously-planned Sprint 11 content below
— Growth Modules, remaining Admin workflows, and the Creative Gallery — is therefore **unplaced**,
not cancelled; it needs a future sprint kickoff to assign it a slot:

- FR-EVENT-01: webinar/event scheduling, registration (deduplicated by user+event), attendance
- FR-COLLEGE-01: college directory search/filter/detail, published-only data
- FR-ENQ-01: consented enquiry sharing with colleges, consent version/time stored
- ADMIN-08 §4-5: remaining admin modules (question-bank approval workflow, community moderation
  admin, system settings/feature flags) and their workflows — payments admin moves to Sprint 8
- CREATIVE-10 §8-10 (moved from old Sprint 10 by the Sprint 9 resequencing — see D-54): revision
  cycles, consent-gated community gallery (private by default), peer rating, XP/achievement
  idempotency

Sprint 11's actual delivered scope:

- Course Recommendations, Similar Courses, Continue Learning (delegates to the existing
  `ProgressService.listContinueLearning()`, Sprint 3), Learning Path Recommendations
- Quiz Recommendations, Assignment Recommendations, Related Community Discussions
- Personalization signals reused from existing data: Learning Progress/Quiz Performance/Assignment
  Performance (`StudentAnalyticsService`, Sprint 10), Community Activity, Mentor Feedback (recency
  only, no text analysis), Enrollment, and a derived category-affinity "interests" signal
- Recommendation Engine: `RecommendationService` facade, per-type domain services, rule-based
  scoring + ranking utilities, explainable `{score, reason}` metadata on every result
- Feature flags: a new `RecommendationFeatureFlag` model lets an admin disable any recommendation
  type platform-wide; `/feature-flags` (admin)
- Reuses existing Authentication, Course Management, Learning Engine, Quiz Engine, Creative
  Assignment Engine, Mentor Management, and Community modules — no duplicated business logic; three
  modules (`AnalyticsModule`, `CommunityModule`, `MentoringModule`) gained new `exports` entries to
  make that reuse possible
- No external AI services — every recommendation is a deterministic, rule-based score over existing
  Prisma data

**Exit criteria**: Every recommendation surface returns real, explainable results computed from
existing platform data with no external AI calls; an admin can disable any recommendation type via
feature flag and it fails closed (empty list, not an error) for students; RBAC enforced
(`recommendations:read:own` for students, `recommendations:admin` for feature-flag management).

## Sprint 12 — CMS & Publishing Workflow

Status: **Complete** (2026-08-01). 667 automated tests pass (413 unit/integration + 254 e2e),
including 72 new Sprint 12 tests (54 unit/integration + 18 e2e). See ADR-0022 for the full design
(workflow/versioning engine, media library, scheduling, permission model, page placement).

Content note (see D-57): this kickoff explicitly redefined Sprint 12 to "CMS & Publishing
Workflow," directing that the roadmap not otherwise be modified. The previously-planned Sprint 12
content below — "Scoring, Reports & Recommendations v0" — is therefore **unplaced**, not
cancelled; it joins Sprint 11's unplaced Growth Modules/Full Admin/Creative Gallery scope (see
D-56) pending a future sprint kickoff to assign it a slot:

- FR-QUIZ-04: automatic objective scoring per published rules, audit timestamp, persisted once —
  substantially already delivered by Sprint 4's automatic scoring; this sprint closes any remaining
  gaps against the full FR-QUIZ-04 acceptance criteria
- FR-QUIZ-05: question reporting (student flags a faulty question without affecting their result)
- FR-REPORT-01: score, accuracy, time, answer approach, topic performance, question review;
  completed-attempt snapshot stable even if questions are later edited
- FR-REC-01: next-step recommendations from mastery/recency/results/weightage, each with a stored,
  reproducible reason (no black-box output yet — full AI engine is Phase 6)

Sprint 12's actual delivered scope:

- Content Workflow: Draft → Review → Approval → Publish → Archive for Landing Pages, Static Pages,
  FAQ, Announcements, and Banners — one shared `assertValidCmsTransition` state machine and
  `CmsVersioningService` engine reused by all four content-type services (`CmsPagesService`,
  `CmsFaqService`, `CmsAnnouncementsService`, `CmsBannersService`), rather than four bespoke
  implementations
- Versioning: Content Version History, Compare Versions (field-by-field diff), Restore Version
  (writes a new version rather than mutating history) — one generic `CmsContentVersion` table keyed
  by `(contentType, contentId)`, not a table per content type
- Publishing: Scheduled Publish/Unpublish via a one-time delayed BullMQ job per
  `(contentType, contentId, action)` (`CmsSchedulingProcessor`, mirroring Sprint 9's
  `NotificationQueueService.scheduleNotification` delayed-job pattern, not ADR-0020's repeatable
  scheduler); Preview Mode via the admin `GET :id` route returning full content regardless of
  workflow status, rather than a separate preview-token mechanism
- Media Management: presigned-upload Media Library reusing Sprint 5's `StoragePort`/
  `MalwareScannerPort` primitives, quarantine-by-default scanning (`CmsAssetScanQueueService`/
  `CmsAssetScanProcessor`, a third sibling of Sprint 5/7's malware-scan queue trio per the
  established ADR-0017 precedent), and Asset Reuse tracking (`CmsAssetUsage`) scoped to Banners'
  structural `imageAssetId` FK
- CMS: Landing Pages and Static Pages unified as one `CmsPage` model (`pageType` discriminator),
  FAQ, Announcements, Banner Management (placement/position)
- Search: `CmsSearchService` keyword search across published Pages/FAQ/Announcements, mirroring
  `CommunitySearchService`'s MVP shape (Prisma `contains`, no full-text index yet)
- Public reads (`@Public()`, no permission required) for every PUBLISHED content item; admin
  authoring gated by new `cms:manage`/`cms:publish` permissions (ADMINISTRATOR-only — no dedicated
  content-editor/reviewer role exists yet, tracked as TD-045), mirroring Sprint 2's
  `content:manage`/`content:publish` Author/Publisher split
- Reuses existing Authentication, Storage, Malware Scanning, Audit, and BullMQ scheduling
  infrastructure — no duplicated business logic

**Exit criteria**: Every content type completes the full Draft→Review→Approval→Publish→Archive
lifecycle with version history and restore; scheduled publish/unpublish fires without manual
intervention; public routes only ever serve PUBLISHED content; RBAC enforced (`cms:manage` for
authoring, `cms:publish` for publish/schedule/archive transitions).

## Sprint 13 — Stabilization & Release Readiness

Status: **Complete** (2026-08-01), scope refined by the kickoff to code-level architecture/
performance/security review, safe fixes, documentation sync, and release preparation for v1.0.0 —
no new business features. 676 automated tests pass (420 unit/integration + 256 e2e, including 9 new
Sprint 13 tests proving the rate-limiting and CORS fail-closed fixes). See
[ADR-0023](../adr/0023-production-readiness-hardening.md) for the full design of every fix, and
`docs/release/v1.0.0/` for the six release-preparation documents.

Delivered against the original bullets below:

- SEC-13 (security review): **done** as a code-level review (auth, RBAC, JWT, refresh tokens,
  cookies, rate limiting, input validation, file uploads, secrets, SQL injection, XSS, CSRF) with
  fixes for every genuine issue found — no rate limiting existed anywhere (added, `@nestjs/throttler`,
  tightened further on auth endpoints), CORS silently failed open in production when unconfigured
  (now fails closed at boot), three background job queues had no retry policy (fixed). **Not
  performed**: an actual third-party penetration test — out of scope for an in-repo code review;
  tracked as a residual gap in the Production Readiness Report, not silently dropped
- QA-15 (regression pass): **done** via the full automated suite (676 tests, including a fresh e2e
  run against every prior sprint's coverage) rather than manual UAT sign-off, which needs a human
  Product Owner and isn't something this sprint can perform on its own
- OPS-24 (Docker/CI/deployment review): **done** — found and fixed two real bugs that meant none of
  the three Dockerfiles had ever actually built successfully (TD-010), verified via real
  `docker build`/`docker run` against docker-compose Postgres/Redis/MinIO for the first time;
  production runbooks and live monitoring/alerting are **not done** (no infra target environment
  exists yet — TD-007/TD-003) and are named explicitly in the Known Limitations report instead
- PERF-32 (load/stress/spike/soak testing against SLAs): **not performed** — no load-testing
  tooling (k6/artillery/similar) is available in this environment; a static N+1-query and
  missing-index audit was performed instead (six indexes added, largest fan-out patterns documented
  as TD-046), which is a different, narrower kind of performance work than live load testing against
  p95/LCP/availability SLAs. Named as a residual gap, not claimed as done
- WCAG 2.1 AA accessibility audit: **not performed** — not named in the Sprint 13 kickoff's explicit
  review checklist (Architecture/Performance/Security/Testing/Documentation/DevOps/Release
  Preparation); left for a future dedicated pass rather than attempted partially under this sprint's
  scope

**Exit criteria** (as actually achievable from a code-level audit sprint): every genuine
architecture/performance/security issue found has either been fixed or is explicitly tracked in
`docs/TECHNICAL_DEBT_REGISTER.md`/the Known Limitations report with a rationale for deferring it;
the full automated suite is green; Docker images are verified buildable and runnable; all
documentation (README, ADRs, Sprint Backlog, Technical Debt Register, Decisions & Assumptions,
Swagger) is synchronized with the codebase's actual current state.

---

## Post-MVP: Phase 6 (Intelligence)

Not sprint-planned yet — deliberately deferred until Phase 1-5 are in production and generating
real usage data (see `IMPLEMENTATION_ROADMAP.md` Phase 6 note). Re-plan as its own sprint cycle
when scheduled.
