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
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];
