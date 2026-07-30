import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { NotificationQueueService } from "./notification-queue.service";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService (integration)", () => {
  let service: NotificationsService;
  let preferences: NotificationPreferencesService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let userId: string;
  const enqueueDelivery = jest.fn(async () => undefined);
  const suffix = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        NotificationPreferencesService,
        PrismaService,
        {
          provide: NotificationQueueService,
          useValue: { enqueueDelivery, scheduleNotification: async () => undefined },
        },
      ],
    }).compile();
    service = moduleRef.get(NotificationsService);
    preferences = moduleRef.get(NotificationPreferencesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const user = await prisma.user.create({
      data: { email: `notif-svc-${suffix}@example.test`, status: "ACTIVE" },
    });
    userId = user.id;
  });

  afterEach(() => {
    enqueueDelivery.mockClear();
  });

  afterAll(async () => {
    await prisma.notificationDelivery.deleteMany({
      where: { notification: { userId } },
    });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.notificationPreference.deleteMany({ where: { userId } });
    await prisma.webPushSubscription.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await moduleRef.close();
  });

  async function resetPreferences(): Promise<void> {
    await prisma.notificationPreference.deleteMany({ where: { userId } });
  }

  it("always creates an IN_APP delivery, already DELIVERED, with no queue hop", async () => {
    const notification = await service.enqueue({
      userId,
      eventType: "test.basic",
      category: "test",
      title: "Hello",
      body: "World",
    });

    const deliveries = await prisma.notificationDelivery.findMany({
      where: { notificationId: notification.id },
    });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].channel).toBe("IN_APP");
    expect(deliveries[0].status).toBe("DELIVERED");
    expect(enqueueDelivery).not.toHaveBeenCalled();
  });

  it("enqueues an additional channel as QUEUED and hands it to the queue", async () => {
    await resetPreferences();
    const notification = await service.enqueue({
      userId,
      eventType: "test.email",
      category: "test",
      title: "Hello",
      body: "World",
      channels: ["EMAIL"],
    });

    const emailDelivery = await prisma.notificationDelivery.findFirst({
      where: { notificationId: notification.id, channel: "EMAIL" },
    });
    expect(emailDelivery?.status).toBe("QUEUED");
    expect(enqueueDelivery).toHaveBeenCalledWith(emailDelivery?.id);
  });

  it("never creates a delivery for MOBILE_PUSH (no live integration)", async () => {
    await resetPreferences();
    const notification = await service.enqueue({
      userId,
      eventType: "test.mobile",
      category: "test",
      title: "Hello",
      body: "World",
      channels: ["MOBILE_PUSH"],
    });

    const deliveries = await prisma.notificationDelivery.findMany({
      where: { notificationId: notification.id },
    });
    expect(deliveries.map((d) => d.channel)).toEqual(["IN_APP"]);
  });

  it("suppresses an opted-out channel instead of queuing it", async () => {
    await resetPreferences();
    await preferences.update(userId, { emailEnabled: false });

    const notification = await service.enqueue({
      userId,
      eventType: "test.opted-out",
      category: "test",
      title: "Hello",
      body: "World",
      channels: ["EMAIL"],
    });

    const emailDelivery = await prisma.notificationDelivery.findFirst({
      where: { notificationId: notification.id, channel: "EMAIL" },
    });
    expect(emailDelivery?.status).toBe("SUPPRESSED");
    expect(emailDelivery?.suppressedReason).toBe("channel_opted_out");
    expect(enqueueDelivery).not.toHaveBeenCalled();
  });

  it("suppresses a muted category", async () => {
    await resetPreferences();
    await preferences.update(userId, { mutedCategories: ["test"] });

    const notification = await service.enqueue({
      userId,
      eventType: "test.muted",
      category: "test",
      title: "Hello",
      body: "World",
      channels: ["EMAIL"],
    });

    const emailDelivery = await prisma.notificationDelivery.findFirst({
      where: { notificationId: notification.id, channel: "EMAIL" },
    });
    expect(emailDelivery?.status).toBe("SUPPRESSED");
    expect(emailDelivery?.suppressedReason).toBe("category_muted");
  });

  it("suppresses a channel while inside the user's DND window", async () => {
    await resetPreferences();
    const now = new Date();
    const nowMinute = now.getUTCHours() * 60 + now.getUTCMinutes();
    await preferences.update(userId, {
      timezone: "UTC",
      dndStartMinute: (nowMinute - 1 + 1440) % 1440,
      dndEndMinute: (nowMinute + 2) % 1440,
    });

    const notification = await service.enqueue({
      userId,
      eventType: "test.dnd",
      category: "test",
      title: "Hello",
      body: "World",
      channels: ["EMAIL"],
    });

    const emailDelivery = await prisma.notificationDelivery.findFirst({
      where: { notificationId: notification.id, channel: "EMAIL" },
    });
    expect(emailDelivery?.status).toBe("SUPPRESSED");
    expect(emailDelivery?.suppressedReason).toBe("dnd_window");
  });

  it("a transactional notification bypasses opt-out, mute, and DND suppression", async () => {
    await resetPreferences();
    const now = new Date();
    const nowMinute = now.getUTCHours() * 60 + now.getUTCMinutes();
    await preferences.update(userId, {
      emailEnabled: false,
      mutedCategories: ["test"],
      timezone: "UTC",
      dndStartMinute: (nowMinute - 1 + 1440) % 1440,
      dndEndMinute: (nowMinute + 2) % 1440,
    });

    const notification = await service.enqueue({
      userId,
      eventType: "test.transactional",
      category: "test",
      title: "Security alert",
      body: "New device login",
      channels: ["EMAIL"],
      isTransactional: true,
    });

    const emailDelivery = await prisma.notificationDelivery.findFirst({
      where: { notificationId: notification.id, channel: "EMAIL" },
    });
    expect(emailDelivery?.status).toBe("QUEUED");
    expect(enqueueDelivery).toHaveBeenCalledWith(emailDelivery?.id);
  });

  it("WEB_PUSH fans out to every registered subscription", async () => {
    await resetPreferences();
    await prisma.webPushSubscription.createMany({
      data: [
        {
          userId,
          endpoint: `https://push.example.test/${suffix}-fanout-1`,
          p256dh: "a",
          auth: "a",
        },
        {
          userId,
          endpoint: `https://push.example.test/${suffix}-fanout-2`,
          p256dh: "b",
          auth: "b",
        },
      ],
    });

    const notification = await service.enqueue({
      userId,
      eventType: "test.webpush",
      category: "test",
      title: "Hello",
      body: "World",
      channels: ["WEB_PUSH"],
    });

    const deliveries = await prisma.notificationDelivery.findMany({
      where: { notificationId: notification.id, channel: "WEB_PUSH" },
    });
    expect(deliveries).toHaveLength(2);
    expect(deliveries.every((d) => d.status === "QUEUED")).toBe(true);
    expect(deliveries.every((d) => d.webPushSubscription !== null)).toBe(true);
    expect(enqueueDelivery).toHaveBeenCalledTimes(2);

    await prisma.webPushSubscription.deleteMany({ where: { userId } });
  });

  it("WEB_PUSH with no registered subscription fails immediately without queuing", async () => {
    await resetPreferences();
    const notification = await service.enqueue({
      userId,
      eventType: "test.webpush-none",
      category: "test",
      title: "Hello",
      body: "World",
      channels: ["WEB_PUSH"],
    });

    const delivery = await prisma.notificationDelivery.findFirst({
      where: { notificationId: notification.id, channel: "WEB_PUSH" },
    });
    expect(delivery?.status).toBe("FAILED");
    expect(delivery?.lastError).toBe("No push subscription");
    expect(enqueueDelivery).not.toHaveBeenCalled();
  });

  describe("reading and marking notifications", () => {
    it("listMine, unread count, markRead and markAllRead behave correctly", async () => {
      await resetPreferences();
      const a = await service.enqueue({
        userId,
        eventType: "test.read.a",
        category: "test",
        title: "A",
        body: "A",
      });
      await service.enqueue({
        userId,
        eventType: "test.read.b",
        category: "test",
        title: "B",
        body: "B",
      });

      const unreadBefore = await service.getUnreadCount(userId);
      expect(unreadBefore).toBeGreaterThanOrEqual(2);

      const read = await service.markRead(userId, a.id);
      expect(read.isRead).toBe(true);

      // Marking an already-read notification again is a no-op, not an error.
      const readAgain = await service.markRead(userId, a.id);
      expect(readAgain.isRead).toBe(true);

      await service.markAllRead(userId);
      expect(await service.getUnreadCount(userId)).toBe(0);

      const { items, total } = await service.listMine(userId, { page: 1, pageSize: 10 });
      expect(total).toBeGreaterThanOrEqual(2);
      expect(items.every((n) => n.isRead)).toBe(true);
    });

    it("markRead throws NotFoundException for another user's notification", async () => {
      const stranger = await prisma.user.create({
        data: { email: `notif-stranger-${suffix}@example.test`, status: "ACTIVE" },
      });
      const notification = await service.enqueue({
        userId,
        eventType: "test.owned",
        category: "test",
        title: "Mine",
        body: "Mine",
      });

      await expect(service.markRead(stranger.id, notification.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      await prisma.user.deleteMany({ where: { id: stranger.id } });
    });

    it("getMineDetailOrThrow forbids access to another user's notification", async () => {
      const stranger = await prisma.user.create({
        data: { email: `notif-stranger2-${suffix}@example.test`, status: "ACTIVE" },
      });
      const notification = await service.enqueue({
        userId,
        eventType: "test.forbidden",
        category: "test",
        title: "Mine",
        body: "Mine",
      });

      await expect(
        service.getMineDetailOrThrow(stranger.id, notification.id),
      ).rejects.toBeInstanceOf(ForbiddenException);

      await prisma.user.deleteMany({ where: { id: stranger.id } });
    });
  });

  it("broadcast fans out one notification per targeted user", async () => {
    const other = await prisma.user.create({
      data: { email: `notif-broadcast-${suffix}@example.test`, status: "ACTIVE" },
    });

    const result = await service.broadcast({
      userIds: [userId, other.id],
      eventType: "test.broadcast",
      category: "test",
      title: "Announcement",
      body: "Hello everyone",
    });

    expect(result.count).toBe(2);
    const forOther = await prisma.notification.findFirst({
      where: { userId: other.id, eventType: "test.broadcast" },
    });
    expect(forOther).not.toBeNull();

    await prisma.notification.deleteMany({ where: { userId: other.id } });
    await prisma.user.deleteMany({ where: { id: other.id } });
  });
});
