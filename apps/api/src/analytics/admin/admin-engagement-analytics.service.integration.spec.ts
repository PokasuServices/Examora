import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminEngagementAnalyticsService } from "./admin-engagement-analytics.service";

describe("AdminEngagementAnalyticsService (integration)", () => {
  let service: AdminEngagementAnalyticsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let userId: string;
  let categoryId: string;
  let boardId: string;
  let threadId: string;
  let notificationId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [AdminEngagementAnalyticsService, PrismaService],
    }).compile();
    service = moduleRef.get(AdminEngagementAnalyticsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const user = await prisma.user.create({
      data: { email: `engagement-analytics-${suffix}@example.test`, status: "ACTIVE" },
    });
    userId = user.id;

    const category = await prisma.forumCategory.create({
      data: { title: `Engagement Category ${suffix}`, slug: `engagement-category-${suffix}` },
    });
    categoryId = category.id;
    const board = await prisma.forumBoard.create({
      data: { categoryId, title: `Engagement Board ${suffix}`, slug: `engagement-board-${suffix}` },
    });
    boardId = board.id;
    const thread = await prisma.thread.create({
      data: {
        boardId,
        authorId: userId,
        type: "QUESTION",
        title: "How does this work?",
        body: "body",
        isSolved: true,
      },
    });
    threadId = thread.id;

    const notification = await prisma.notification.create({
      data: { userId, eventType: "test.engagement", category: "test", title: "t", body: "b" },
    });
    notificationId = notification.id;
    await prisma.notificationDelivery.create({
      data: { notificationId, channel: "EMAIL", status: "DELIVERED" },
    });
    await prisma.notificationDelivery.create({
      data: { notificationId, channel: "EMAIL", status: "FAILED" },
    });
  });

  afterAll(async () => {
    await prisma.notificationDelivery.deleteMany({ where: { notificationId } });
    await prisma.notification.deleteMany({ where: { id: notificationId } });
    await prisma.thread.deleteMany({ where: { id: threadId } });
    await prisma.forumBoard.deleteMany({ where: { id: boardId } });
    await prisma.forumCategory.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await moduleRef.close();
  });

  it("counts real threads/replies and a solved-question rate", async () => {
    const analytics = await service.getCommunityAnalytics(30);
    expect(analytics.totalThreads).toBeGreaterThanOrEqual(1);
    expect(analytics.threadsByDay.length).toBe(30);
    expect(analytics.acceptedAnswerRate).not.toBeNull();
  });

  it("breaks down real delivery status counts by channel", async () => {
    const analytics = await service.getNotificationDeliveryAnalytics();
    expect(analytics.totalNotifications).toBeGreaterThanOrEqual(1);
    const emailChannel = analytics.deliveryByChannel.find((c) => c.channel === "EMAIL");
    expect(emailChannel).toBeDefined();
    expect(emailChannel!.delivered).toBeGreaterThanOrEqual(1);
    expect(emailChannel!.failed).toBeGreaterThanOrEqual(1);
    expect(emailChannel!.successRate).not.toBeNull();
  });
});
