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
];
