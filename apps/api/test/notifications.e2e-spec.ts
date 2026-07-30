import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { configureApp } from "../src/setup-app";
import { registerUserWithRoles } from "./support/auth-helpers";
import { ensureRolesAndPermissions } from "./support/seed-helpers";

/**
 * Sprint 9 Notification, Communication & Engagement e2e (ADR-0019,
 * COMM-MERGED): preferences, Web Push subscription management, the
 * Notification Center (list/unread/read), admin delivery tracking + the
 * broadcast composer, template CRUD, category-mute suppression, and the
 * real BullMQ retry -> exhaustion -> DLQ -> channel-fallback pipeline (a
 * user with no phone number makes SMS/WhatsApp fail deterministically,
 * without depending on real Twilio credentials).
 */
describe("Notification, Communication & Engagement (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  let studentId: string;
  let student2Id: string;
  const suffix = `${Date.now()}`;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function pollNotificationDetail(
    id: string,
    predicate: (body: {
      deliveries: Array<{ id: string; channel: string; status: string }>;
    }) => boolean,
    timeoutMs = 20_000,
  ): Promise<{
    deliveries: Array<{ id: string; channel: string; status: string; fallbackFromId?: string }>;
  }> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/notifications/${id}`)
        .set(auth(adminToken))
        .expect(200);
      if (predicate(res.body.data)) {
        return res.body.data;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error(`Timed out waiting for notification ${id}'s delivery state`);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await ensureRolesAndPermissions(prisma);

    adminToken = (
      await registerUserWithRoles(app, prisma, `s9-admin-${suffix}@example.test`, ["ADMINISTRATOR"])
    ).accessToken;
    const student = await registerUserWithRoles(app, prisma, `s9-student-${suffix}@example.test`, [
      "STUDENT",
    ]);
    studentToken = student.accessToken;
    studentId = student.userId;
    const student2 = await registerUserWithRoles(
      app,
      prisma,
      `s9-student2-${suffix}@example.test`,
      ["STUDENT"],
    );
    student2Id = student2.userId;
  });

  afterAll(async () => {
    await prisma.notificationDelivery.deleteMany({
      where: { notification: { userId: { in: [studentId, student2Id] } } },
    });
    await prisma.notification.deleteMany({ where: { userId: { in: [studentId, student2Id] } } });
    await prisma.notificationPreference.deleteMany({
      where: { userId: { in: [studentId, student2Id] } },
    });
    await prisma.webPushSubscription.deleteMany({ where: { userId: studentId } });
    await prisma.notificationTemplate.deleteMany({ where: { eventType: { contains: suffix } } });
    await prisma.user.deleteMany({ where: { email: { contains: "s9-" } } });
    await app.close();
  });

  describe("RBAC", () => {
    it("denies unauthenticated access to the notification center, preferences and admin routes", async () => {
      await request(app.getHttpServer()).get("/api/v1/notifications").expect(401);
      await request(app.getHttpServer()).get("/api/v1/notifications/preferences").expect(401);
      await request(app.getHttpServer()).get("/api/v1/admin/notifications").expect(401);
    });

    it("denies a student the admin delivery-tracking and broadcast routes", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/notifications")
        .set(auth(studentToken))
        .expect(403);
      await request(app.getHttpServer())
        .post("/api/v1/admin/notifications/broadcast")
        .set(auth(studentToken))
        .send({ userIds: [studentId], eventType: "x", category: "x", title: "x", body: "x" })
        .expect(403);
    });
  });

  describe("preferences", () => {
    it("defaults to all channels enabled with no mutes or DND", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/notifications/preferences")
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.emailEnabled).toBe(true);
      expect(res.body.data.mutedCategories).toEqual([]);
      expect(res.body.data.dndStartMinute).toBeNull();
    });

    it("persists an update to channels, mute list, DND window, language and timezone", async () => {
      const res = await request(app.getHttpServer())
        .patch("/api/v1/notifications/preferences")
        .set(auth(studentToken))
        .send({
          smsEnabled: false,
          mutedCategories: ["community"],
          dndStartMinute: 1320,
          dndEndMinute: 360,
          language: "hi",
          timezone: "Asia/Kolkata",
        })
        .expect(200);
      expect(res.body.data.smsEnabled).toBe(false);
      expect(res.body.data.mutedCategories).toEqual(["community"]);
      expect(res.body.data.dndStartMinute).toBe(1320);
      expect(res.body.data.timezone).toBe("Asia/Kolkata");

      const reread = await request(app.getHttpServer())
        .get("/api/v1/notifications/preferences")
        .set(auth(studentToken))
        .expect(200);
      expect(reread.body.data.language).toBe("hi");

      // Reset the DND window — the student is shared across every describe
      // block in this file, and a stale 22:00-06:00 window would otherwise
      // intermittently (and correctly) SUPPRESS the EMAIL deliveries later
      // tests assert reach DELIVERED, depending on real wall-clock time.
      await request(app.getHttpServer())
        .patch("/api/v1/notifications/preferences")
        .set(auth(studentToken))
        .send({ dndStartMinute: null, dndEndMinute: null, smsEnabled: true })
        .expect(200);
    });

    it("rejects a DND minute outside 0-1439", async () => {
      await request(app.getHttpServer())
        .patch("/api/v1/notifications/preferences")
        .set(auth(studentToken))
        .send({ dndStartMinute: 1500 })
        .expect(422);
    });
  });

  describe("Web Push subscriptions", () => {
    const endpoint = `https://push.example.test/e2e-${suffix}`;

    it("registers, lists, and unregisters a subscription", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/notifications/web-push-subscriptions")
        .set(auth(studentToken))
        .send({ endpoint, p256dh: "p256dh-key", auth: "auth-key" })
        .expect(201);

      const listed = await request(app.getHttpServer())
        .get("/api/v1/notifications/web-push-subscriptions")
        .set(auth(studentToken))
        .expect(200);
      expect(listed.body.data.some((s: { endpoint: string }) => s.endpoint === endpoint)).toBe(
        true,
      );

      await request(app.getHttpServer())
        .delete("/api/v1/notifications/web-push-subscriptions")
        .set(auth(studentToken))
        .query({ endpoint })
        .expect(204);

      const afterDelete = await request(app.getHttpServer())
        .get("/api/v1/notifications/web-push-subscriptions")
        .set(auth(studentToken))
        .expect(200);
      expect(afterDelete.body.data.some((s: { endpoint: string }) => s.endpoint === endpoint)).toBe(
        false,
      );
    });
  });

  describe("Notification Center + real delivery workflow", () => {
    let notificationId: string;

    it("admin broadcasts an EMAIL notification, which arrives instantly in-app and is eventually DELIVERED on EMAIL", async () => {
      const broadcast = await request(app.getHttpServer())
        .post("/api/v1/admin/notifications/broadcast")
        .set(auth(adminToken))
        .send({
          userIds: [studentId],
          eventType: `test.center.${suffix}`,
          category: "test",
          title: "Welcome",
          body: "Thanks for joining",
          channels: ["EMAIL"],
        })
        .expect(201);
      expect(broadcast.body.data.count).toBe(1);

      const mine = await request(app.getHttpServer())
        .get("/api/v1/notifications")
        .set(auth(studentToken))
        .expect(200);
      const found = mine.body.data.items.find(
        (n: { eventType: string }) => n.eventType === `test.center.${suffix}`,
      );
      expect(found).toBeDefined();
      expect(found.isRead).toBe(false);
      notificationId = found.id;

      const unread = await request(app.getHttpServer())
        .get("/api/v1/notifications/unread-count")
        .set(auth(studentToken))
        .expect(200);
      expect(unread.body.data.unread).toBeGreaterThanOrEqual(1);

      const detail = await pollNotificationDetail(notificationId, (body) =>
        body.deliveries.some((d) => d.channel === "EMAIL" && d.status === "DELIVERED"),
      );
      const inApp = detail.deliveries.find((d) => d.channel === "IN_APP");
      expect(inApp?.status).toBe("DELIVERED");
    }, 25_000);

    it("marks the notification read, and read-all clears the remaining unread count", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${notificationId}/read`)
        .set(auth(studentToken))
        .expect(200);

      const mine = await request(app.getHttpServer())
        .get("/api/v1/notifications")
        .set(auth(studentToken))
        .expect(200);
      const found = mine.body.data.items.find((n: { id: string }) => n.id === notificationId);
      expect(found.isRead).toBe(true);

      await request(app.getHttpServer())
        .post("/api/v1/notifications/read-all")
        .set(auth(studentToken))
        .expect(201);

      const unread = await request(app.getHttpServer())
        .get("/api/v1/notifications/unread-count")
        .set(auth(studentToken))
        .expect(200);
      expect(unread.body.data.unread).toBe(0);
    });

    it("a student cannot view another student's notification via the admin detail route without notification:manage", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/admin/notifications/${notificationId}`)
        .set(auth(studentToken))
        .expect(403);
    });
  });

  describe("category mute suppression", () => {
    it("suppresses the EMAIL delivery for a muted category while still showing IN_APP", async () => {
      await request(app.getHttpServer())
        .patch("/api/v1/notifications/preferences")
        .set(auth(studentToken))
        .send({ mutedCategories: ["muted-test"] })
        .expect(200);

      const broadcast = await request(app.getHttpServer())
        .post("/api/v1/admin/notifications/broadcast")
        .set(auth(adminToken))
        .send({
          userIds: [studentId],
          eventType: `test.muted.${suffix}`,
          category: "muted-test",
          title: "Should be muted",
          body: "Should be muted",
          channels: ["EMAIL"],
        })
        .expect(201);
      expect(broadcast.body.data.count).toBe(1);

      const list = await request(app.getHttpServer())
        .get(`/api/v1/admin/notifications?eventType=test.muted.${suffix}`)
        .set(auth(adminToken))
        .expect(200);
      const notification = list.body.data.items[0];
      const emailDelivery = notification.deliveries.find(
        (d: { channel: string }) => d.channel === "EMAIL",
      );
      expect(emailDelivery.status).toBe("SUPPRESSED");
      expect(emailDelivery.suppressedReason).toBe("category_muted");
      const inApp = notification.deliveries.find(
        (d: { channel: string }) => d.channel === "IN_APP",
      );
      expect(inApp.status).toBe("DELIVERED");

      // Un-mute so it doesn't affect later tests in this file.
      await request(app.getHttpServer())
        .patch("/api/v1/notifications/preferences")
        .set(auth(studentToken))
        .send({ mutedCategories: [] })
        .expect(200);
    });
  });

  describe("retry -> exhaustion -> DLQ -> channel fallback", () => {
    it("a WHATSAPP delivery to a user with no phone number fails every attempt, ends FAILED, and escalates to a fallback SMS delivery", async () => {
      const broadcast = await request(app.getHttpServer())
        .post("/api/v1/admin/notifications/broadcast")
        .set(auth(adminToken))
        .send({
          userIds: [student2Id],
          eventType: `test.dlq.${suffix}`,
          category: "test",
          title: "No phone on file",
          body: "This should exhaust retries",
          channels: ["WHATSAPP"],
        })
        .expect(201);
      expect(broadcast.body.data.count).toBe(1);

      const list = await request(app.getHttpServer())
        .get(`/api/v1/admin/notifications?eventType=test.dlq.${suffix}`)
        .set(auth(adminToken))
        .expect(200);
      const notificationId: string = list.body.data.items[0].id;

      const detail = await pollNotificationDetail(
        notificationId,
        (body) => body.deliveries.some((d) => d.channel === "SMS"),
        40_000,
      );

      const whatsapp = detail.deliveries.find((d) => d.channel === "WHATSAPP");
      expect(whatsapp?.status).toBe("FAILED");

      const fallbackSms = detail.deliveries.find((d) => d.channel === "SMS");
      expect(fallbackSms).toBeDefined();
      expect(fallbackSms?.fallbackFromId).toBe(whatsapp?.id ?? undefined);

      const auditLog = await prisma.auditLog.findFirst({
        where: { action: "notifications.delivery_exhausted", entityId: whatsapp?.id },
      });
      expect(auditLog).not.toBeNull();
    }, 45_000);
  });

  describe("admin template management", () => {
    let templateId: string;
    const eventType = `test.template.${suffix}`;

    it("creates, lists, fetches and updates a template", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/admin/notifications/templates")
        .set(auth(adminToken))
        .send({
          eventType,
          channel: "EMAIL",
          subject: "Hi {{name}}",
          bodyTemplate: "Welcome, {{name}}!",
        })
        .expect(201);
      templateId = created.body.data.id;
      expect(created.body.data.isActive).toBe(true);

      const found = await request(app.getHttpServer())
        .get(`/api/v1/admin/notifications/templates/${templateId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(found.body.data.eventType).toBe(eventType);

      // Regression guard: the plain (id-less) list route must resolve to
      // NotificationTemplatesAdminController, not get swallowed by
      // AdminNotificationsController's GET admin/notifications/:id.
      const listed = await request(app.getHttpServer())
        .get("/api/v1/admin/notifications/templates")
        .set(auth(adminToken))
        .expect(200);
      expect(listed.body.data.items.some((t: { id: string }) => t.id === templateId)).toBe(true);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/admin/notifications/templates/${templateId}`)
        .set(auth(adminToken))
        .send({ isActive: false })
        .expect(200);
      expect(updated.body.data.isActive).toBe(false);
    });

    it("rejects a duplicate (eventType, channel) template", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/admin/notifications/templates")
        .set(auth(adminToken))
        .send({ eventType, channel: "EMAIL", bodyTemplate: "dup" })
        .expect(409);
    });

    it("a student cannot manage templates", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/notifications/templates")
        .set(auth(studentToken))
        .expect(403);
    });
  });
});
