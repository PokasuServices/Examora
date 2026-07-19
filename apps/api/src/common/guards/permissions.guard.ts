import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { PermissionCode } from "@examora/types";
import { PermissionsService } from "../../permissions/permissions.service";
import type { RequestUser } from "../../auth/types/request-user";
import { REQUIRE_PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";

/**
 * Enforces @RequirePermissions(...) (DESIGN-03 §3). No endpoint requires a
 * permission unless explicitly decorated — this guard is a no-op otherwise,
 * same "explicit opt-in" pattern as RolesGuard.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(REQUIRE_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Insufficient permissions");
    }

    const granted = await this.permissionsService.getPermissionsForRoles(user.roles);
    const hasAll = required.every((permission) => granted.includes(permission));

    if (!hasAll) {
      this.logger.warn(
        `Access denied: user ${user.id} lacks required permission(s) [${required.join(", ")}] for ${request.method} ${request.url}`,
      );
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
