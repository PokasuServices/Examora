import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { MAILER_PORT } from "../src/mailer/mailer.port";
import { PrismaService } from "../src/prisma/prisma.service";
import { configureApp } from "../src/setup-app";
import { TestMailerService } from "./support/test-mailer";

describe("Users (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `sprint1-users-${Date.now()}@example.test`;
  const adminEmail = `sprint1-users-admin-${Date.now()}@example.test`;
  const password = "a-strong-password-123";
  let accessToken: string;
  let userId: string;

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
    await prisma.role.upsert({
      where: { name: "ADMINISTRATOR" },
      update: {},
      create: { name: "ADMINISTRATOR" },
    });

    const registerRes = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email, password, consentVersion: "v1.0", acceptTerms: true })
      .expect(201);
    accessToken = registerRes.body.data.accessToken;
    userId = registerRes.body.data.user.id;

    // Bootstrap an admin the same way a real deployment must: direct DB
    // promotion for the very first administrator (see Sprint 1 report, "Known Issues").
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email: adminEmail, password, consentVersion: "v1.0", acceptTerms: true })
      .expect(201);
    await prisma.userRole.updateMany({
      where: { user: { email: adminEmail } },
      data: {
        roleId: (await prisma.role.findUniqueOrThrow({ where: { name: "ADMINISTRATOR" } })).id,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: "sprint1-users-" } } });
    await app.close();
  });

  describe("GET/PUT /users/me", () => {
    it("returns the current user's full profile", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.email).toBe(email);
      expect(res.body.data.consentVersion).toBe("v1.0");
      expect(res.body.data.phone).toBeNull();
    });

    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/api/v1/users/me").expect(401);
    });

    it("updates profile fields", async () => {
      const res = await request(app.getHttpServer())
        .put("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          firstName: "Ada",
          lastName: "Lovelace",
          phone: "+15550001111",
          dateOfBirth: "2008-05-14",
          guardianName: "Grace Hopper",
          guardianEmail: "guardian@example.test",
        })
        .expect(200);

      expect(res.body.data.firstName).toBe("Ada");
      expect(res.body.data.lastName).toBe("Lovelace");
      expect(res.body.data.phone).toBe("+15550001111");
      expect(res.body.data.dateOfBirth).toBe("2008-05-14");
      expect(res.body.data.guardianName).toBe("Grace Hopper");
      expect(res.body.data.guardianEmail).toBe("guardian@example.test");
    });

    it("rejects an invalid guardian email", async () => {
      await request(app.getHttpServer())
        .put("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ guardianEmail: "not-an-email" })
        .expect(422);
    });
  });

  describe("POST /users/me/consent", () => {
    it("records a consent decision and it is retrievable via the audit trail", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/users/me/consent")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ type: "MARKETING", version: "v1.0", channel: "web", granted: true })
        .expect(201);

      const record = await prisma.consentRecord.findFirst({
        where: { userId, type: "MARKETING" },
      });
      expect(record?.granted).toBe(true);

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: userId, action: "consent.granted" },
      });
      expect(audit).not.toBeNull();
    });
  });

  describe("GET /users/:id (staff only)", () => {
    it("denies a student viewing another user's profile, even their own id via this route", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/users/${userId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(403);
    });

    it("allows an administrator to view any user's profile", async () => {
      const adminLogin = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: adminEmail, password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/users/${userId}`)
        .set("Authorization", `Bearer ${adminLogin.body.data.accessToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(userId);
    });

    it("returns 404 for a non-existent user id", async () => {
      const adminLogin = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: adminEmail, password })
        .expect(200);

      await request(app.getHttpServer())
        .get("/api/v1/users/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${adminLogin.body.data.accessToken}`)
        .expect(404);
    });
  });
});
