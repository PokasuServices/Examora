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
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];
