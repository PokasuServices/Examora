import { Test, type TestingModule } from "@nestjs/testing";
import { AssignmentCatalogService } from "../../assignments/catalog/assignment-catalog.service";
import type { RequestUser } from "../../auth/types/request-user";
import { QuizCatalogService } from "../../assessment/quiz-catalog/quiz-catalog.service";
import { CatalogService } from "../../learning/catalog.service";
import { PermissionsService } from "../../permissions/permissions.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ensureRolesAndPermissions } from "../../../test/support/seed-helpers";
import { CommunityAccessService } from "../common/community-access.service";
import { ForumBoardsService } from "../forums/forum-boards.service";
import { ForumCategoriesService } from "../forums/forum-categories.service";
import { RepliesService } from "../replies/replies.service";
import { ReputationService } from "../reputation/reputation.service";
import { ThreadsService } from "../threads/threads.service";
import { CommunityModerationService } from "./community-moderation.service";

describe("CommunityModerationService (integration)", () => {
  let service: CommunityModerationService;
  let threadsService: ThreadsService;
  let repliesService: RepliesService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let boardId: string;
  let adminId: string;
  let studentId: string;
  const suffix = `${Date.now()}`;

  const admin = (): RequestUser => ({
    id: adminId,
    email: "a@example.test",
    roles: ["ADMINISTRATOR"],
  });
  const student = (): RequestUser => ({
    id: studentId,
    email: "s@example.test",
    roles: ["STUDENT"],
  });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        CommunityModerationService,
        ThreadsService,
        RepliesService,
        ForumBoardsService,
        ForumCategoriesService,
        CommunityAccessService,
        ReputationService,
        CatalogService,
        QuizCatalogService,
        AssignmentCatalogService,
        PermissionsService,
        PrismaService,
      ],
    }).compile();
    service = moduleRef.get(CommunityModerationService);
    threadsService = moduleRef.get(ThreadsService);
    repliesService = moduleRef.get(RepliesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
    await ensureRolesAndPermissions(prisma);

    const adminUser = await prisma.user.create({
      data: { email: `mod-admin-${suffix}@example.test`, status: "ACTIVE" },
    });
    adminId = adminUser.id;
    const studentUser = await prisma.user.create({
      data: { email: `mod-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = studentUser.id;

    const category = await prisma.forumCategory.create({
      data: { title: `MCat ${suffix}`, slug: `mcat-${suffix}` },
    });
    const board = await prisma.forumBoard.create({
      data: { categoryId: category.id, title: `MBoard ${suffix}`, slug: `mboard-${suffix}` },
    });
    boardId = board.id;
  });

  afterAll(async () => {
    await prisma.reputationEvent.deleteMany({ where: { userId: { in: [adminId, studentId] } } });
    await prisma.communityProfile.deleteMany({ where: { userId: { in: [adminId, studentId] } } });
    await prisma.reply.deleteMany({ where: { thread: { boardId } } });
    await prisma.thread.deleteMany({ where: { boardId } });
    await prisma.forumBoard.deleteMany({ where: { id: boardId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, studentId] } } });
    await moduleRef.close();
  });

  it("hides and restores a thread, recording the moderator", async () => {
    const thread = await threadsService.create(student(), { boardId, title: "Hide me", body: "b" });

    const hidden = await service.hideThread(admin(), thread.id, "Off-topic");
    expect(hidden.isHidden).toBe(true);
    expect(hidden.hiddenReason).toBe("Off-topic");
    expect(hidden.moderatedById).toBe(adminId);

    const restored = await service.restoreThread(admin(), thread.id);
    expect(restored.isHidden).toBe(false);
    expect(restored.hiddenReason).toBeNull();
  });

  it("locks and unlocks a thread", async () => {
    const thread = await threadsService.create(student(), { boardId, title: "Lock me", body: "b" });
    const locked = await service.lockThread(admin(), thread.id);
    expect(locked.isLocked).toBe(true);
    const unlocked = await service.unlockThread(admin(), thread.id);
    expect(unlocked.isLocked).toBe(false);
  });

  it("pins and unpins a thread", async () => {
    const thread = await threadsService.create(student(), { boardId, title: "Pin me", body: "b" });
    const pinned = await service.pinThread(admin(), thread.id);
    expect(pinned.isPinned).toBe(true);
    const unpinned = await service.unpinThread(admin(), thread.id);
    expect(unpinned.isPinned).toBe(false);
  });

  it("hides and restores a reply", async () => {
    const thread = await threadsService.create(student(), { boardId, title: "Thread", body: "b" });
    const reply = await repliesService.create(student(), thread.id, { body: "A reply" });

    const hidden = await service.hideReply(admin(), reply.id, "Spam");
    expect(hidden.isHidden).toBe(true);
    expect(hidden.hiddenReason).toBe("Spam");

    const restored = await service.restoreReply(admin(), reply.id);
    expect(restored.isHidden).toBe(false);
  });
});
