import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { WebPushSubscriptionsService } from "./web-push-subscriptions.service";

describe("WebPushSubscriptionsService (integration)", () => {
  let service: WebPushSubscriptionsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let userId: string;
  let otherUserId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [WebPushSubscriptionsService, PrismaService],
    }).compile();
    service = moduleRef.get(WebPushSubscriptionsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const user = await prisma.user.create({
      data: { email: `webpush-${suffix}@example.test`, status: "ACTIVE" },
    });
    userId = user.id;
    const other = await prisma.user.create({
      data: { email: `webpush-other-${suffix}@example.test`, status: "ACTIVE" },
    });
    otherUserId = other.id;
  });

  afterAll(async () => {
    await prisma.webPushSubscription.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await moduleRef.close();
  });

  it("subscribes a new endpoint", async () => {
    const sub = await service.subscribe(userId, {
      endpoint: `https://push.example.test/${suffix}-a`,
      p256dh: "p256dh-key",
      auth: "auth-key",
    });
    expect(sub.userId).toBe(userId);
    expect(sub.endpoint).toBe(`https://push.example.test/${suffix}-a`);
  });

  it("re-subscribing the same endpoint updates it in place rather than duplicating", async () => {
    const endpoint = `https://push.example.test/${suffix}-b`;
    await service.subscribe(userId, { endpoint, p256dh: "old", auth: "old" });
    const updated = await service.subscribe(userId, { endpoint, p256dh: "new", auth: "new" });
    expect(updated.p256dh).toBe("new");

    const count = await prisma.webPushSubscription.count({ where: { endpoint } });
    expect(count).toBe(1);
  });

  it("listMine only returns the caller's own subscriptions", async () => {
    await service.subscribe(otherUserId, {
      endpoint: `https://push.example.test/${suffix}-other`,
      p256dh: "k",
      auth: "a",
    });
    const mine = await service.listMine(userId);
    expect(mine.every((s) => s.userId === userId)).toBe(true);
    expect(mine.some((s) => s.userId === otherUserId)).toBe(false);
  });

  it("unsubscribe only removes a subscription owned by the caller", async () => {
    const endpoint = `https://push.example.test/${suffix}-c`;
    await service.subscribe(userId, { endpoint, p256dh: "k", auth: "a" });

    await service.unsubscribe(otherUserId, endpoint);
    expect(await prisma.webPushSubscription.findUnique({ where: { endpoint } })).not.toBeNull();

    await service.unsubscribe(userId, endpoint);
    expect(await prisma.webPushSubscription.findUnique({ where: { endpoint } })).toBeNull();
  });
});
