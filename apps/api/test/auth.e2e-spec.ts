import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { MAILER_PORT } from "../src/mailer/mailer.port";
import { PrismaService } from "../src/prisma/prisma.service";
import { configureApp } from "../src/setup-app";
import { TestMailerService } from "./support/test-mailer";

/**
 * Sprint 1 auth e2e coverage: registration/consent, email verification,
 * login, forgot/reset password (with session invalidation), refresh
 * rotation, session management, and logout — all against a real Postgres
 * instance (docker-compose locally, service containers in CI).
 */
describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mailer: TestMailerService;
  const email = `sprint1-auth-${Date.now()}@example.test`;
  const password = "a-strong-password-123";
  // Reassigned once reset-password changes it, so later describe blocks log in correctly.
  let currentPassword = password;

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
    mailer = app.get(MAILER_PORT);

    await prisma.role.upsert({
      where: { name: "STUDENT" },
      update: {},
      create: { name: "STUDENT" },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: "sprint1-auth-" } } });
    await app.close();
  });

  describe("registration, consent and email verification", () => {
    it("rejects registration without accepting terms", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ email, password, consentVersion: "v1.0", acceptTerms: false })
        .expect(422);
    });

    it("registers a new account as PENDING_VERIFICATION and emails a verification token", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ email, password, consentVersion: "v1.0", acceptTerms: true })
        .expect(201);

      expect(res.body.data.user.status).toBe("PENDING_VERIFICATION");
      expect(res.body.data.user.emailVerified).toBe(false);
      expect(res.body.data.user.permissions).toEqual(
        expect.arrayContaining(["profile:read:own", "profile:update:own"]),
      );
      expect(res.headers["set-cookie"]).toBeDefined();
      expect(mailer.sent.some((m) => m.to === email && m.subject.includes("Verify"))).toBe(true);

      const consent = await prisma.consentRecord.findFirst({
        where: { user: { email }, type: "TERMS_OF_SERVICE" },
      });
      expect(consent?.granted).toBe(true);
      expect(consent?.version).toBe("v1.0");
    });

    it("rejects duplicate registration", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ email, password, consentVersion: "v1.0", acceptTerms: true })
        .expect(409);
    });

    it("rejects an invalid or already-used verification token", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/verify-email")
        .send({ token: "not-a-real-token" })
        .expect(400);
    });

    it("verifies the account and promotes it to ACTIVE", async () => {
      const token = mailer.latestTokenFor(email);

      await request(app.getHttpServer())
        .post("/api/v1/auth/verify-email")
        .send({ token })
        .expect(200);

      // Token is single-use.
      await request(app.getHttpServer())
        .post("/api/v1/auth/verify-email")
        .send({ token })
        .expect(400);

      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password })
        .expect(200);
      expect(loginRes.body.data.user.status).toBe("ACTIVE");
      expect(loginRes.body.data.user.emailVerified).toBe(true);
    });

    it("resend-verification is a silent no-op once already verified", async () => {
      const sentBefore = mailer.sent.length;
      await request(app.getHttpServer())
        .post("/api/v1/auth/resend-verification")
        .send({ email })
        .expect(204);
      expect(mailer.sent.length).toBe(sentBefore);
    });

    it("resend-verification never confirms whether an email is registered", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/resend-verification")
        .send({ email: "no-such-account@example.test" })
        .expect(204);
    });
  });

  describe("login", () => {
    it("rejects an invalid password without confirming account existence", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password: "wrong-password" })
        .expect(401);
    });

    it("rejects login for a non-existent account with the same generic error", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "no-such-account@example.test", password: "whatever123" })
        .expect(401);
      expect(res.body.error.message).toBe("Invalid email or password");
    });
  });

  describe("forgot / reset password", () => {
    it("always returns 204 regardless of account existence", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/forgot-password")
        .send({ email: "no-such-account@example.test" })
        .expect(204);
      await request(app.getHttpServer())
        .post("/api/v1/auth/forgot-password")
        .send({ email })
        .expect(204);
    });

    it("resets the password, invalidates existing sessions, and allows login with the new password", async () => {
      // Establish a session that reset-password must invalidate.
      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password })
        .expect(200);
      const staleCookie = loginRes.headers["set-cookie"];

      const resetToken = mailer.latestTokenFor(email);
      const newPassword = "a-new-strong-password-456";

      await request(app.getHttpServer())
        .post("/api/v1/auth/reset-password")
        .send({ token: resetToken, newPassword })
        .expect(200);

      // Reset tokens are single-use.
      await request(app.getHttpServer())
        .post("/api/v1/auth/reset-password")
        .send({ token: resetToken, newPassword: "irrelevant12345" })
        .expect(400);

      // The session that existed before the reset is now revoked.
      await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", staleCookie)
        .expect(401);

      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password })
        .expect(401);

      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password: newPassword })
        .expect(200);

      currentPassword = newPassword;
    });
  });

  describe("session management and refresh rotation", () => {
    it("rotates the refresh token on every use — the old cookie stops working", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password: currentPassword })
        .expect(200);
      const originalCookie = loginRes.headers["set-cookie"];

      const refreshRes = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", originalCookie)
        .expect(200);
      expect(refreshRes.body.data.accessToken).toEqual(expect.any(String));
      expect(refreshRes.headers["set-cookie"]).toBeDefined();

      // The original (now-rotated) cookie must no longer work.
      await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", originalCookie)
        .expect(401);

      // But the newly-issued cookie does.
      await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", refreshRes.headers["set-cookie"])
        .expect(200);
    });

    it("lists sessions, revokes one, and revokes the rest", async () => {
      const agentA = request.agent(app.getHttpServer());
      const agentB = request.agent(app.getHttpServer());

      await agentA
        .post("/api/v1/auth/login")
        .send({ email, password: currentPassword })
        .expect(200);
      await agentB
        .post("/api/v1/auth/login")
        .send({ email, password: currentPassword })
        .expect(200);

      const meRes = await agentA.post("/api/v1/auth/refresh").expect(200);
      const accessToken = meRes.body.data.accessToken as string;

      const sessions = await agentA
        .get("/api/v1/auth/sessions")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(sessions.body.data.length).toBeGreaterThanOrEqual(2);
      expect(sessions.body.data.some((s: { isCurrent: boolean }) => s.isCurrent)).toBe(true);

      const otherSession = sessions.body.data.find((s: { isCurrent: boolean }) => !s.isCurrent);
      await agentA
        .delete(`/api/v1/auth/sessions/${otherSession.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(204);

      // agentB's session was the one revoked — its refresh should now fail.
      await agentB.post("/api/v1/auth/refresh").expect(401);

      await agentA
        .delete("/api/v1/auth/sessions")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(204);
    });

    it("cannot revoke a session belonging to another user", async () => {
      const other = `sprint1-auth-other-${Date.now()}@example.test`;
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ email: other, password, consentVersion: "v1.0", acceptTerms: true })
        .expect(201);

      const mineRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password: currentPassword })
        .expect(200);
      const mineAccess = mineRes.body.data.accessToken as string;

      const theirsRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: other, password })
        .expect(200);
      const theirSessionId = (
        await request(app.getHttpServer())
          .get("/api/v1/auth/sessions")
          .set("Authorization", `Bearer ${theirsRes.body.data.accessToken}`)
          .set("Cookie", theirsRes.headers["set-cookie"])
          .expect(200)
      ).body.data[0].id;

      await request(app.getHttpServer())
        .delete(`/api/v1/auth/sessions/${theirSessionId}`)
        .set("Authorization", `Bearer ${mineAccess}`)
        .expect(401);
    });
  });

  describe("logout and unauthenticated access", () => {
    it("supports login -> me -> logout, and refresh fails after logout", async () => {
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent
        .post("/api/v1/auth/login")
        .send({ email, password: currentPassword })
        .expect(200);
      const accessToken = loginRes.body.data.accessToken as string;

      const meRes = await agent
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(meRes.body.data.email).toEqual(email);

      await agent.post("/api/v1/auth/logout").expect(204);
      await agent.post("/api/v1/auth/refresh").expect(401);
    });

    it("rejects /me without a bearer token", async () => {
      await request(app.getHttpServer()).get("/api/v1/auth/me").expect(401);
    });

    it("returns 503 for the Google OAuth start route when unconfigured", async () => {
      await request(app.getHttpServer()).get("/api/v1/auth/google").expect(503);
    });
  });
});
