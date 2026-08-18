/**
 * apps/admin (Sprint-0 design tokens) owns full CRUD for the domains apps/web
 * hasn't natively rebuilt — Assignments, Quizzes, Commerce, Notifications,
 * Community moderation, Mentor program admin, Recommendation feature flags.
 * These are real, working cross-origin links to those management pages.
 *
 * Users, Course content, and CMS were later rebuilt natively in apps/web
 * (see apps/web/src/app/(app)/admin/{users,content,cms}) with a more
 * complete feature set (search/filters/audit trail) than the apps/admin
 * originals — those three now link internally instead of cross-origin.
 *
 * NEXT_PUBLIC_ADMIN_ORIGIN must be the full origin apps/admin is actually
 * reachable at from the browser (e.g. https://admin.example.com in
 * production) — a browser can never reach the server's own localhost, so
 * this must never be hardcoded to "http://localhost:...". Defaults to the
 * local dev admin server when unset.
 */
export const ADMIN_ORIGIN = process.env.NEXT_PUBLIC_ADMIN_ORIGIN ?? "http://localhost:3002";

export const ADMIN_LINKS = {
  assignments: `${ADMIN_ORIGIN}/assignments`,
  quizzes: `${ADMIN_ORIGIN}/assessment/quizzes`,
  commerce: `${ADMIN_ORIGIN}/commerce/orders`,
  refunds: `${ADMIN_ORIGIN}/commerce/refunds`,
  notifications: `${ADMIN_ORIGIN}/notifications`,
  moderation: `${ADMIN_ORIGIN}/community/moderation`,
  mentors: `${ADMIN_ORIGIN}/mentors`,
  forums: `${ADMIN_ORIGIN}/community/forums`,
  featureFlags: `${ADMIN_ORIGIN}/feature-flags`,
} as const;
