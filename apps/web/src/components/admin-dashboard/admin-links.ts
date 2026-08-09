/**
 * apps/admin (Sprint-0 design tokens) already owns full CRUD for these
 * domains — Users, Course content, Assignments, Quizzes, CMS, Commerce,
 * Notifications. Rather than rebuild that surface in apps/web (out of scope
 * for "redesign the dashboard"), these are real, working cross-origin links
 * to the actual management pages, using the same NEXT_PUBLIC_ADMIN_PORT the
 * rest of the monorepo already relies on.
 */
export const ADMIN_ORIGIN = `http://localhost:${process.env.NEXT_PUBLIC_ADMIN_PORT ?? "3002"}`;

export const ADMIN_LINKS = {
  users: `${ADMIN_ORIGIN}/users`,
  courses: `${ADMIN_ORIGIN}/content/courses`,
  assignments: `${ADMIN_ORIGIN}/assignments`,
  quizzes: `${ADMIN_ORIGIN}/assessment/quizzes`,
  cms: `${ADMIN_ORIGIN}/cms/pages`,
  commerce: `${ADMIN_ORIGIN}/commerce/orders`,
  refunds: `${ADMIN_ORIGIN}/commerce/refunds`,
  notifications: `${ADMIN_ORIGIN}/notifications`,
  moderation: `${ADMIN_ORIGIN}/community/moderation`,
} as const;
