# ADR-0010: Permissions Framework — Role→Permission Join, Resolved Per-Request

Status: Accepted
Date: 2026-07-18
Deciders: Engineering

## Context

DESIGN-03 §3 calls for a "Permissions Framework" distinct from coarse role checks (`@Roles()`,
Sprint 0). Sprint 1 needs a mechanism to grant fine-grained capabilities (e.g. `users:manage`)
without hardcoding role names into every authorization check, so future roles/permissions can be
added by seeding data rather than shipping code changes.

## Decision

- Permission codes are plain strings in a `resource:action[:scope]` convention (e.g.
  `profile:read:own`, `users:manage`), listed centrally in `packages/types/src/permission.ts` as
  `PERMISSION_CODES` — one canonical list shared by backend validation and (future) frontend
  capability checks.
- `Permission` and `RolePermission` (already in the Sprint 0 schema) hold the seeded mapping;
  `PermissionsService.getPermissionsForRoles(roles)` resolves a user's effective permissions with a
  single DB query per check, run against the user's roles from the JWT.
- `@RequirePermissions(...)` + `PermissionsGuard` enforce it, registered globally (`APP_GUARD`)
  alongside `JwtAuthGuard` and `RolesGuard` — a no-op unless a route opts in, matching the existing
  "explicit opt-in" pattern from Sprint 0.
- No caching layer yet: every guarded request re-queries `role_permissions`.

## Consequences

- Adding a new permission to a role is a data change (seed/admin action), not a deploy — once a
  role-permission admin UI exists (deferred, see ADR-0010 Alternatives), permission grants can
  change without a release.
- `@Roles()` and `@RequirePermissions()` coexist deliberately: roles answer "what kind of actor is
  this," permissions answer "can this actor do this specific thing." Both are enforced by separate,
  independently-composable guards.
- Every permission-gated request costs one extra DB round trip. Acceptable at Sprint 1 scale;
  tracked as TD-014 (Redis-backed permission caching) for when it isn't.

## Alternatives Considered

- **Embed permissions directly in the JWT at login**: rejected — would require forcing re-login (or
  a token-refresh-triggered recompute, which we do have via rotation) for a permission change to
  take effect, and bloats the token. Deferred as a possible future optimization if the DB-lookup
  cost becomes a real bottleneck.
- **Runtime role-permission editing UI in Sprint 1**: rejected — DESIGN-03's "Permissions Framework"
  deliverable is the _mechanism_; a UI to edit role-permission mappings without a deploy is
  reasonably ADMIN-08 (Sprint 11) scope. Sprint 1 seeds the initial mapping via `database/prisma/seed.ts`.
