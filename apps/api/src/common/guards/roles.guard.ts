import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
// NOTE: Reflector is constructor-injected — must stay a VALUE import, see TD-011.
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { RoleName } from "@examora/types";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { RequestUser } from "../../auth/types/request-user";

/**
 * RBAC scaffold (SEC-13 §3-4). Denies and audits (via Logger for now — wired
 * to AuditLog once the audit module exists in Sprint 1) any request whose
 * user lacks a required role. No controller declares @Roles(...) yet in
 * Sprint 0; this guard exists so the pattern is established before business
 * endpoints are added.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    const hasRole = Boolean(user?.roles.some((role) => requiredRoles.includes(role)));

    if (!hasRole) {
      this.logger.warn(
        `Access denied: user ${user?.id ?? "unknown"} lacks required role(s) [${requiredRoles.join(", ")}] for ${request.method} ${request.url}`,
      );
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
