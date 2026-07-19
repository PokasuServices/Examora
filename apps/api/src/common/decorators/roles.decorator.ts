import { SetMetadata } from "@nestjs/common";
import type { RoleName } from "@examora/types";

export const ROLES_KEY = "roles";

/**
 * RBAC scaffold only (SEC-13 §3). No endpoint uses this yet in Sprint 0 — the
 * full role/permission matrix is Sprint 1 (DESIGN-03 §3). Present now so
 * AuthModule and its guards have something concrete to compile against.
 */
export const Roles = (...roles: RoleName[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
