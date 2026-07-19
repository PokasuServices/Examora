import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { RoleName } from "@examora/types";
import type { PrismaService } from "../../src/prisma/prisma.service";

const PASSWORD = "a-strong-password-123";

/** Registers a user and returns an access token (STUDENT role). */
export async function registerUser(
  app: INestApplication,
  email: string,
): Promise<{ accessToken: string; userId: string }> {
  const res = await request(app.getHttpServer())
    .post("/api/v1/auth/register")
    .send({ email, password: PASSWORD, consentVersion: "v1.0", acceptTerms: true })
    .expect(201);
  return { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
}

/**
 * Registers a user, sets their roles directly in the DB (the only way to make
 * the first admin — self-registration grants STUDENT only), and returns a fresh
 * token that reflects the assigned roles.
 */
export async function registerUserWithRoles(
  app: INestApplication,
  prisma: PrismaService,
  email: string,
  roles: RoleName[],
): Promise<{ accessToken: string; userId: string }> {
  const { userId } = await registerUser(app, email);

  const roleRows = await prisma.role.findMany({ where: { name: { in: roles } } });
  await prisma.userRole.deleteMany({ where: { userId } });
  await prisma.userRole.createMany({
    data: roleRows.map((role) => ({ userId, roleId: role.id })),
  });

  const login = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD })
    .expect(200);
  return { accessToken: login.body.data.accessToken, userId };
}
