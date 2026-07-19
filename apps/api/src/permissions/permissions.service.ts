import { Injectable } from "@nestjs/common";
import type { PermissionCode, RoleName } from "@examora/types";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Resolves a user's effective permissions from their roles (DESIGN-03 §3).
 * Sprint 1 queries the DB directly on every check — fine at current scale.
 * Redis-backed caching is a deliberate deferral (see TD-014), not an oversight.
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPermissionsForRoles(roles: RoleName[]): Promise<PermissionCode[]> {
    if (roles.length === 0) {
      return [];
    }

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role: { name: { in: roles } } },
      select: { permission: { select: { code: true } } },
    });

    const codes = new Set(rolePermissions.map((rp) => rp.permission.code as PermissionCode));
    return [...codes];
  }
}
