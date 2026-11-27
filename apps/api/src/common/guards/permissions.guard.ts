import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { DELETION_NEEDS_APPROVAL, type PermissionCode } from "@examora/types";
import { PermissionsService } from "../../permissions/permissions.service";
import type { RequestUser } from "../../auth/types/request-user";
import {
  PROTECTED_DELETE_KEY,
  type ProtectedDeleteMeta,
} from "../decorators/protected-delete.decorator";
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
    const protectedDelete = this.reflector.get<ProtectedDeleteMeta | undefined>(
      PROTECTED_DELETE_KEY,
      context.getHandler(),
    );

    if ((!required || required.length === 0) && !protectedDelete) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Insufficient permissions");
    }

    const granted = await this.permissionsService.getPermissionsForRoles(user.roles);
    const hasAll = (required ?? []).every((permission) => granted.includes(permission));

    if (!hasAll) {
      this.logger.warn(
        `Access denied: user ${user.id} lacks required permission(s) [${required.join(", ")}] for ${request.method} ${request.url}`,
      );
      throw new ForbiddenException("Insufficient permissions");
    }

    // Staff deletes: without deletion:direct (mentors) the record stays, and
    // the client offers a deletion request for an administrator instead.
    if (protectedDelete && !granted.includes("deletion:direct")) {
      throw new ForbiddenException({
        error: DELETION_NEEDS_APPROVAL,
        message: protectedDelete.target
          ? "Deleting this needs an administrator's approval. Send a deletion request instead."
          : "Only an administrator can delete this.",
      });
    }

    return true;
  }
}
