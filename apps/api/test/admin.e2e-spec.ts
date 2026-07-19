import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { MAILER_PORT } from "../src/mailer/mailer.port";
import { PrismaService } from "../src/prisma/prisma.service";
import { configureApp } from "../src/setup-app";
import { TestMailerService } from "./support/test-mailer";

describe("Admin (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const studentEmail = `sprint1-admin-student-${Date.now()}@example.test`;
  const adminEmail = `sprint1-admin-admin-${Date.now()}@example.test`;
  const password = "a-strong-password-123";
  let studentId: string;
  let studentAccessToken: string;
  let adminAccessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MAILER_PORT)
      .useClass(TestMailerService)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.role.upsert({
      where: { name: "STUDENT" },
      update: {},
      create: { name: "STUDENT" },
    });
    const adminRole = await prisma.role.upsert({
      where: { name: "ADMINISTRATOR" },
      update: {},
      create: { name: "ADMINISTRATOR" },
    });
    await prisma.role.upsert({ where: { name: "MENTOR" }, update: {}, create: { name: "MENTOR" } });
    await prisma.role.upsert({
      where: { name: "REVIEWER" },
      update: {},
      create: { name: "REVIEWER" },
    });

    const studentRes = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email: studentEmail, password, consentVersion: "v1.0", acceptTerms: true })
      .expect(201);
    studentId = studentRes.body.data.user.id;
    studentAccessToken = studentRes.body.data.accessToken;

    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email: adminEmail, password, consentVersion: "v1.0", acceptTerms: true })
      .expect(201);
    await prisma.userRole.updateMany({
      where: { user: { email: adminEmail } },
      data: { roleId: adminRole.id },
    });
    const adminLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: adminEmail, password })
      .expect(200);
    adminAccessToken = adminLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: "sprint1-admin-" } } });
    await app.close();
  });

  describe("RBAC — non-admin denial", () => {
    it("denies a student listing users", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${studentAccessToken}`)
        .expect(403);
    });

    it("denies a student reading audit logs", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/audit-logs")
        .set("Authorization", `Bearer ${studentAccessToken}`)
        .expect(403);
    });

    it("denies a student assigning roles", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${studentId}/roles`)
        .set("Authorization", `Bearer ${studentAccessToken}`)
        .send({ roles: ["ADMINISTRATOR"] })
        .expect(403);
    });
  });

  describe("GET /admin/users", () => {
    it("lists users with pagination", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/users?page=1&pageSize=50")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
      expect(res.body.data.items.some((u: { email: string }) => u.email === studentEmail)).toBe(
        true,
      );
    });
  });

  describe("PATCH /admin/users/:id/roles", () => {
    it("replaces a user's role assignments and audits the change", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${studentId}/roles`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ roles: ["MENTOR", "REVIEWER"] })
        .expect(200);

      expect(res.body.data.roles.sort()).toEqual(["MENTOR", "REVIEWER"]);
      expect(res.body.data.permissions).toEqual(
        expect.arrayContaining(["profile:read:own", "sessions:manage:own"]),
      );

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: studentId, action: "admin.user_roles_updated" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit?.afterState).toEqual({ roles: ["MENTOR", "REVIEWER"] });
    });

    it("rejects an unknown role name", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${studentId}/roles`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ roles: ["SUPERHERO"] })
        .expect(422);
    });
  });

  describe("PATCH /admin/users/:id/status", () => {
    it("suspends a user, revoking their sessions and blocking further login", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: studentEmail, password })
        .expect(200);
      const staleCookie = loginRes.headers["set-cookie"];

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${studentId}/status`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ status: "SUSPENDED" })
        .expect(200);

      // Pre-existing session is revoked immediately.
      await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", staleCookie)
        .expect(401);

      // New login attempts are blocked with a distinct message (not the
      // generic invalid-credentials one, since the password was correct).
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: studentEmail, password })
        .expect(401);
      expect(res.body.error.message.toLowerCase()).toContain("suspended");
    });

    it("reactivating a user restores login access", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${studentId}/status`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ status: "ACTIVE" })
        .expect(200);

      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: studentEmail, password })
        .expect(200);
    });
  });

  describe("GET /admin/audit-logs", () => {
    it("returns a filterable, paginated audit trail", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/audit-logs?entityType=User&pageSize=100`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body.data.items.length).toBeGreaterThan(0);
      expect(
        res.body.data.items.some(
          (entry: { action: string; entityId: string }) =>
            entry.action === "admin.user_roles_updated" && entry.entityId === studentId,
        ),
      ).toBe(true);
    });
  });
});
