/**
 * Permission codes seeded in Sprint 1 (DESIGN-03 §3 "Permissions Framework").
 * This is the Identity-domain subset only — each future module (Course,
 * Assessment, Creative, ...) adds its own codes here as it ships, following
 * the same `resource:action[:scope]` convention.
 */
export const PERMISSION_CODES = [
  "profile:read:own",
  "profile:update:own",
  "sessions:manage:own",
  "users:manage",
  "roles:manage",
  "audit_logs:read",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];
