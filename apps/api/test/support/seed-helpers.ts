import {
  BASELINE_PERMISSION_CODES,
  PERMISSION_CODES,
  REVIEWER_PERMISSION_CODES,
  ROLE_NAMES,
} from "@examora/types";
import type { PrismaService } from "../../src/prisma/prisma.service";

/**
 * Makes an e2e spec self-sufficient: ensures all roles + permissions exist,
 * that ADMINISTRATOR holds every permission, MENTOR/REVIEWER hold
 * REVIEWER_PERMISSION_CODES, and every other role holds
 * BASELINE_PERMISSION_CODES — mirroring database/prisma/seed.ts's role
 * matrix — regardless of whether `db:seed` has been run against the test
 * database. (Previously this only wired ADMINISTRATOR, which happened to
 * work locally only because the persisted dev DB already had a real
 * `db:seed` run's data; a genuinely fresh database — e.g. CI, which never
 * calls `db:seed` — would have 403'd every non-admin baseline-permission
 * assertion. Fixed as part of Sprint 4.)
 */
export async function ensureRolesAndPermissions(prisma: PrismaService): Promise<void> {
  await Promise.all(
    ROLE_NAMES.map((name) => prisma.role.upsert({ where: { name }, update: {}, create: { name } })),
  );
  await Promise.all(
    PERMISSION_CODES.map((code) =>
      prisma.permission.upsert({ where: { code }, update: {}, create: { code } }),
    ),
  );

  const roles = await prisma.role.findMany({ where: { name: { in: [...ROLE_NAMES] } } });
  const permissions = await prisma.permission.findMany({
    where: { code: { in: [...PERMISSION_CODES] } },
  });
  const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));

  for (const role of roles) {
    const codes =
      role.name === "ADMINISTRATOR"
        ? PERMISSION_CODES
        : role.name === "MENTOR" || role.name === "REVIEWER"
          ? REVIEWER_PERMISSION_CODES
          : BASELINE_PERMISSION_CODES;
    for (const code of codes) {
      const permissionId = permissionIdByCode.get(code);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }
}
