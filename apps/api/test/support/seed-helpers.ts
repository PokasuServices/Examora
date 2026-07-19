import { PERMISSION_CODES, ROLE_NAMES } from "@examora/types";
import type { PrismaService } from "../../src/prisma/prisma.service";

/**
 * Makes an e2e spec self-sufficient: ensures all roles + permissions exist and
 * that ADMINISTRATOR holds every permission, regardless of whether `db:seed`
 * has been run against the test database.
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

  const admin = await prisma.role.findUniqueOrThrow({ where: { name: "ADMINISTRATOR" } });
  const permissions = await prisma.permission.findMany({
    where: { code: { in: [...PERMISSION_CODES] } },
  });
  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: admin.id, permissionId: permission.id } },
      update: {},
      create: { roleId: admin.id, permissionId: permission.id },
    });
  }
}
