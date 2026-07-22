import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { CommunityActivityService } from "./community-activity.service";

describe("CommunityActivityService (integration)", () => {
  let service: CommunityActivityService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let userId: string;
  let boardId: string;
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [CommunityActivityService, PrismaService],
    }).compile();
    service = moduleRef.get(CommunityActivityService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const user = await prisma.user.create({
      data: { email: `activity-user-${suffix}@example.test`, status: "ACTIVE" },
    });
    userId = user.id;

    const category = await prisma.forumCategory.create({
      data: { title: `ACat ${suffix}`, slug: `acat-${suffix}` },
    });
    const board = await prisma.forumBoard.create({
      data: { categoryId: category.id, title: `ABoard ${suffix}`, slug: `aboard-${suffix}` },
    });
    boardId = board.id;

    const thread = await prisma.thread.create({
      data: { boardId, authorId: userId, title: "My thread", body: "b" },
    });
    await prisma.reply.create({
      data: { threadId: thread.id, authorId: userId, body: "My reply" },
    });
    await prisma.communityLike.create({
      data: { userId, targetType: "THREAD", targetId: thread.id },
    });
    await prisma.reputationEvent.create({
      data: { userId, points: 5, reason: "Thread created" },
    });
  });

  afterAll(async () => {
    await prisma.reputationEvent.deleteMany({ where: { userId } });
    await prisma.communityLike.deleteMany({ where: { userId } });
    await prisma.reply.deleteMany({ where: { authorId: userId } });
    await prisma.thread.deleteMany({ where: { boardId } });
    await prisma.forumBoard.deleteMany({ where: { id: boardId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await moduleRef.close();
  });

  it("merges threads, replies, likes and reputation events, sorted newest-first", async () => {
    const timeline = await service.getTimeline(userId);
    const types = timeline.map((item) => item.type);
    expect(types).toEqual(
      expect.arrayContaining(["THREAD_CREATED", "REPLY_POSTED", "LIKE_GIVEN", "REPUTATION_EVENT"]),
    );

    const timestamps = timeline.map((item) => item.occurredAt);
    const sorted = [...timestamps].sort((a, b) => (a < b ? 1 : -1));
    expect(timestamps).toEqual(sorted);
  });
});
