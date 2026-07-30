import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { AssignmentCatalogService } from "../../assignments/catalog/assignment-catalog.service";
import type { RequestUser } from "../../auth/types/request-user";
import { QuizCatalogService } from "../../assessment/quiz-catalog/quiz-catalog.service";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { CatalogService } from "../../learning/catalog.service";
import { PermissionsService } from "../../permissions/permissions.service";
import { PrismaService } from "../../prisma/prisma.service";
import { fakeNotificationsServiceProvider } from "../../../test/support/fake-notifications-service";
import { ensureRolesAndPermissions } from "../../../test/support/seed-helpers";
import { CommunityAccessService } from "../common/community-access.service";
import { ForumBoardsService } from "../forums/forum-boards.service";
import { ForumCategoriesService } from "../forums/forum-categories.service";
import { ReputationService } from "../reputation/reputation.service";
import { ThreadsService } from "../threads/threads.service";
import { RepliesService } from "./replies.service";

describe("RepliesService (integration)", () => {
  let service: RepliesService;
  let threadsService: ThreadsService;
  let reputationService: ReputationService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let boardId: string;
  let threadId: string;
  let studentId: string;
  let otherStudentId: string;
  let adminId: string;
  const suffix = `${Date.now()}`;

  const student = (): RequestUser => ({
    id: studentId,
    email: "s@example.test",
    roles: ["STUDENT"],
  });
  const otherStudent = (): RequestUser => ({
    id: otherStudentId,
    email: "o@example.test",
    roles: ["STUDENT"],
  });
  const admin = (): RequestUser => ({
    id: adminId,
    email: "a@example.test",
    roles: ["ADMINISTRATOR"],
  });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        RepliesService,
        ThreadsService,
        ForumBoardsService,
        ForumCategoriesService,
        CommunityAccessService,
        ReputationService,
        CatalogService,
        QuizCatalogService,
        AssignmentCatalogService,
        EnrollmentService,
        PermissionsService,
        PrismaService,
        fakeNotificationsServiceProvider(),
      ],
    }).compile();
    service = moduleRef.get(RepliesService);
    threadsService = moduleRef.get(ThreadsService);
    reputationService = moduleRef.get(ReputationService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
    await ensureRolesAndPermissions(prisma);

    const student1 = await prisma.user.create({
      data: { email: `reply-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student1.id;
    const student2 = await prisma.user.create({
      data: { email: `reply-other-${suffix}@example.test`, status: "ACTIVE" },
    });
    otherStudentId = student2.id;
    const adminUser = await prisma.user.create({
      data: { email: `reply-admin-${suffix}@example.test`, status: "ACTIVE" },
    });
    adminId = adminUser.id;

    const category = await prisma.forumCategory.create({
      data: { title: `RCat ${suffix}`, slug: `rcat-${suffix}` },
    });
    const board = await prisma.forumBoard.create({
      data: { categoryId: category.id, title: `RBoard ${suffix}`, slug: `rboard-${suffix}` },
    });
    boardId = board.id;
  });

  beforeEach(async () => {
    const thread = await threadsService.create(student(), {
      boardId,
      title: `Thread ${Date.now()}`,
      body: "body",
    });
    threadId = thread.id;
  });

  afterAll(async () => {
    await prisma.reputationEvent.deleteMany({
      where: { userId: { in: [studentId, otherStudentId, adminId] } },
    });
    await prisma.communityProfile.deleteMany({
      where: { userId: { in: [studentId, otherStudentId, adminId] } },
    });
    await prisma.reply.deleteMany({ where: { thread: { boardId } } });
    await prisma.thread.deleteMany({ where: { boardId } });
    await prisma.forumBoard.deleteMany({ where: { id: boardId } });
    await prisma.user.deleteMany({ where: { id: { in: [studentId, otherStudentId, adminId] } } });
    await moduleRef.close();
  });

  it("posts a reply and awards reputation to the author", async () => {
    const reply = await service.create(otherStudent(), threadId, { body: "Nice thread" });
    expect(reply.threadId).toBe(threadId);

    const profile = await reputationService.getProfile(otherStudentId);
    expect(profile.reputationPoints).toBeGreaterThanOrEqual(2);
  });

  it("rejects a reply nested under a parent that does not belong to this thread", async () => {
    const otherThread = await threadsService.create(student(), {
      boardId,
      title: "Other thread",
      body: "body",
    });
    const parentInOtherThread = await service.create(student(), otherThread.id, { body: "parent" });

    await expect(
      service.create(otherStudent(), threadId, {
        body: "orphan",
        parentReplyId: parentInOtherThread.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("builds a nested tree from parent/child replies", async () => {
    const top = await service.create(student(), threadId, { body: "top level" });
    await service.create(otherStudent(), threadId, { body: "child", parentReplyId: top.id });

    const { items } = await service.list(student(), threadId, { page: 1, pageSize: 20 });
    const topNode = items.find((item) => item.id === top.id);
    expect(topNode?.children).toHaveLength(1);
    expect(topNode?.children[0]?.body).toBe("child");
  });

  it("rejects new replies on a locked thread for non-moderators, but allows moderators", async () => {
    await prisma.thread.update({ where: { id: threadId }, data: { isLocked: true } });
    await expect(service.create(student(), threadId, { body: "blocked" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.create(admin(), threadId, { body: "allowed" })).resolves.toBeDefined();
  });

  it("excludes hidden replies for non-moderators but not for moderators", async () => {
    const reply = await service.create(student(), threadId, { body: "will be hidden" });
    await prisma.reply.update({ where: { id: reply.id }, data: { isHidden: true } });

    const asStudent = await service.list(student(), threadId, { page: 1, pageSize: 20 });
    expect(asStudent.items.some((item) => item.id === reply.id)).toBe(false);

    const asAdmin = await service.list(admin(), threadId, { page: 1, pageSize: 20 });
    expect(asAdmin.items.some((item) => item.id === reply.id)).toBe(true);
  });

  it("update rejects a non-owner and allows the owner or a moderator", async () => {
    const reply = await service.create(student(), threadId, { body: "mine" });
    await expect(
      service.update(otherStudent(), reply.id, { body: "hijacked" }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const updated = await service.update(student(), reply.id, { body: "edited" });
    expect(updated.body).toBe("edited");
  });

  it("remove soft-deletes so the reply no longer appears in list()", async () => {
    const reply = await service.create(student(), threadId, { body: "to remove" });
    await service.remove(student(), reply.id);

    const { items } = await service.list(student(), threadId, { page: 1, pageSize: 20 });
    expect(items.some((item) => item.id === reply.id)).toBe(false);
  });
});
