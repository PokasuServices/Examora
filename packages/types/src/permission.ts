/**
 * Permission codes seeded across sprints (DESIGN-03 §3 "Permissions Framework").
 * Each module adds its own codes here as it ships, following the
 * `resource:action[:scope]` convention.
 */
export const PERMISSION_CODES = [
  // Identity (Sprint 1)
  "profile:read:own",
  "profile:update:own",
  "sessions:manage:own",
  "users:manage",
  "roles:manage",
  "audit_logs:read",
  // Content management (Sprint 2). `content:manage` authors/edits the hierarchy;
  // `content:publish` gates the publish/archive status transitions (CMS-29 §7
  // separates Author from Publisher).
  "content:manage",
  "content:publish",
  // Learning engine (Sprint 3). `content:read` authorises reading PUBLISHED
  // content (every role); `progress:read` gates the admin read-only progress
  // dashboard (ADMINISTRATOR only). Own-progress endpoints are self-scoped and
  // need only authentication (ADR-0013).
  "content:read",
  "progress:read",
  // Assessment & Quiz Engine (Sprint 4, ADR-0014). `question:manage` authors
  // the question bank; `quiz:manage`/`quiz:publish` mirror the content
  // author/publisher split. `quiz:read` authorises browsing/attempting
  // PUBLISHED quizzes (every role, like content:read). `quiz:attempts:read`
  // gates admin attempt monitoring + result dashboards. Own-attempt endpoints
  // (start/resume/autosave/submit/history) are self-scoped and need only
  // authentication + quiz:read, matching the ADR-0013 own-progress precedent.
  "question:manage",
  "quiz:manage",
  "quiz:publish",
  "quiz:read",
  "quiz:attempts:read",
  // Creative Assignment Engine (Sprint 5, ADR-0015). `assignment:manage`
  // authors assignments/templates/rubrics and assigns reviewers;
  // `assignment:publish` mirrors the content/quiz author-publisher split.
  // `assignment:read` authorises browsing PUBLISHED assignments and
  // submitting to them (every role, like content:read/quiz:read — own-
  // submission endpoints are self-scoped per the ADR-0013 precedent).
  // `assignment:review` gates the reviewer dashboard and rubric review
  // actions (MENTOR + REVIEWER roles, not baseline).
  "assignment:manage",
  "assignment:publish",
  "assignment:read",
  "assignment:review",
  // Mentor Management (Sprint 6, ADR-0016). `mentor:manage` is ADMINISTRATOR-
  // only: mentor profile CRUD, mentor↔student assignment, workload dashboard.
  // `mentor:workflow` is the first permission to diverge MENTOR from REVIEWER
  // — it gates Student 360, notes, tasks, feedback and meetings for a
  // mentor's own assigned students (ownership enforced in the service layer,
  // since ADMINISTRATOR already holds every code and this guard is AND-only).
  "mentor:manage",
  "mentor:workflow",
  // Community & Discussion Module (Sprint 7, ADR-0017). `community:read` is
  // baseline: browsing forums/threads plus self-scoped writing (post a
  // thread/reply/question/answer, like, bookmark, follow, report), mirroring
  // the assignment:read/quiz:read precedent (ADR-0013). `community:manage`
  // is ADMINISTRATOR-only: forum category/board CRUD. `community:moderate`
  // is ADMINISTRATOR-only: hide/restore/delete, lock/unlock, pin/unpin, and
  // report-queue review. No dedicated MODERATOR role yet (TD-030).
  "community:read",
  "community:manage",
  "community:moderate",
  // Commerce, Enrollment & Payments (Sprint 8, ADR-0018). `commerce:read` is
  // baseline: browse course pricing (already public via the catalog),
  // purchase a course, view own enrollments/orders/payments/invoices, and
  // request a refund on your own order — mirroring the assignment:read/
  // quiz:read/community:read precedent (ADR-0013). `commerce:manage` is
  // ADMINISTRATOR-only: coupon CRUD, order/payment monitoring, refund
  // review, and manually granting/revoking enrollment.
  "commerce:read",
  "commerce:manage",
  // Notification, Communication & Engagement (Sprint 9, ADR-0019). `notification:read`
  // is baseline: read own notifications (Notification Center), own preferences,
  // manage own Web Push subscriptions — mirroring the commerce:read/community:read
  // precedent (ADR-0013). `notification:manage` is ADMINISTRATOR-only: template CRUD,
  // broadcast/announcement composition, delivery-tracking dashboard.
  "notification:read",
  "notification:manage",
  // Analytics & Reporting (Sprint 10, ADR-0020). `analytics:read:own` is baseline:
  // a student's own learning/quiz/assignment analytics dashboard — mirrors
  // profile:read:own. `analytics:mentor` is MENTOR-role-only, added alongside
  // mentor:workflow: a mentor's dashboard scoped to their own assigned students,
  // ownership enforced in the service layer (ADR-0016 precedent). `analytics:admin`
  // is ADMINISTRATOR-only: every cross-user/cross-course platform dashboard, the
  // report builder, exports, and scheduled reports.
  "analytics:read:own",
  "analytics:mentor",
  "analytics:admin",
  // AI Recommendation Engine (Sprint 11, ADR-0021). `recommendations:read:own`
  // is baseline: a student's own personalized recommendations (courses,
  // quizzes, assignments, learning path, continue learning, similar courses,
  // related discussions) — mirrors analytics:read:own. `recommendations:admin`
  // is ADMINISTRATOR-only: per-type feature-flag management.
  "recommendations:read:own",
  "recommendations:admin",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

/**
 * Codes every role gets, seeded by `database/prisma/seed.ts` and mirrored by
 * `apps/api/test/support/seed-helpers.ts#ensureRolesAndPermissions` so e2e
 * specs are self-sufficient on a fresh database rather than depending on a
 * prior `db:seed` run. Keep this the single source of truth for "baseline" —
 * do not duplicate the list inline in either consumer.
 */
export const BASELINE_PERMISSION_CODES: PermissionCode[] = [
  "profile:read:own",
  "profile:update:own",
  "sessions:manage:own",
  "content:read",
  "quiz:read",
  "assignment:read",
  "community:read",
  "commerce:read",
  "notification:read",
  "analytics:read:own",
  "recommendations:read:own",
];

/** Granted to MENTOR and REVIEWER in addition to the baseline (ADR-0015). */
export const REVIEWER_PERMISSION_CODES: PermissionCode[] = [
  ...BASELINE_PERMISSION_CODES,
  "assignment:review",
];

/**
 * Granted to MENTOR only, in addition to REVIEWER_PERMISSION_CODES (ADR-0016,
 * Sprint 6) — the first sprint where MENTOR and REVIEWER permissions diverge.
 * A plain REVIEWER reviews creative-assignment submissions but does not get
 * a student caseload, notes, tasks, feedback, or meetings.
 */
export const MENTOR_PERMISSION_CODES: PermissionCode[] = [
  ...REVIEWER_PERMISSION_CODES,
  "mentor:workflow",
  "analytics:mentor",
];
