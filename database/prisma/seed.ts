import {
  BASELINE_PERMISSION_CODES,
  PERMISSION_CODES,
  type PermissionCode,
  type RoleName,
} from "@examora/types";
import { PrismaClient } from "../generated/client/index.js";

const prisma = new PrismaClient();

const ROLES: RoleName[] = ["STUDENT", "MENTOR", "REVIEWER", "ADMINISTRATOR", "GUARDIAN"];

/**
 * Role→permission matrix (DESIGN-03 §3). Every role gets BASELINE_PERMISSION_CODES
 * (own profile + sessions, content:read, quiz:read); ADMINISTRATOR gets
 * everything, including Sprint 2 content:manage/publish (CMS-29 §7), the
 * Sprint 3 admin progress dashboard (progress:read), and the Sprint 4
 * question bank / quiz authoring / attempt monitoring (question:manage,
 * quiz:manage, quiz:publish, quiz:attempts:read). Finer content roles
 * (Author/Publisher) are deferred. Future modules extend this.
 */
const ROLE_PERMISSIONS: Record<RoleName, PermissionCode[]> = {
  STUDENT: BASELINE_PERMISSION_CODES,
  MENTOR: BASELINE_PERMISSION_CODES,
  REVIEWER: BASELINE_PERMISSION_CODES,
  GUARDIAN: BASELINE_PERMISSION_CODES,
  ADMINISTRATOR: [...PERMISSION_CODES],
};

async function main(): Promise<void> {
  const roleRows = await Promise.all(
    ROLES.map((name) => prisma.role.upsert({ where: { name }, update: {}, create: { name } })),
  );
  const roleIdByName = new Map(roleRows.map((role) => [role.name, role.id]));

  const permissionRows = await Promise.all(
    PERMISSION_CODES.map((code) =>
      prisma.permission.upsert({ where: { code }, update: {}, create: { code } }),
    ),
  );
  const permissionIdByCode = new Map(
    permissionRows.map((permission) => [permission.code, permission.id]),
  );

  for (const roleName of ROLES) {
    const roleId = roleIdByName.get(roleName);
    if (!roleId) continue;

    for (const code of ROLE_PERMISSIONS[roleName]) {
      const permissionId = permissionIdByCode.get(code);
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  // eslint-disable-next-line no-console -- seed script CLI output, not application logging
  console.log(
    `Seeded ${roleRows.length} roles, ${permissionRows.length} permissions, and role-permission mappings.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
