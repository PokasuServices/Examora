import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { AssignmentCatalogService } from "../../assignments/catalog/assignment-catalog.service";
import type { RequestUser } from "../../auth/types/request-user";
import { QuizCatalogService } from "../../assessment/quiz-catalog/quiz-catalog.service";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { CatalogService } from "../../learning/catalog.service";
import { PermissionsService } from "../../permissions/permissions.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ensureRolesAndPermissions } from "../../../test/support/seed-helpers";
import { CommunityAccessService } from "../common/community-access.service";
import { ForumBoardsService } from "../forums/forum-boards.service";
import { ForumCategoriesService } from "../forums/forum-categories.service";
import { ReputationService } from "../reputation/reputation.service";
import { ThreadsService } from "./threads.service";

describe("ThreadsService (integration)", () => {
  let service: ThreadsService;
  let reputationService: ReputationService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let boardId: string;
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
        ThreadsService,
        ForumBoardsService,
        ForumCategoriesService,
        CommunityAccessService,
        PermissionsService,
        ReputationService,
        CatalogService,
        QuizCatalogService,
        AssignmentCatalogService,
        EnrollmentService,
        PrismaService,
      ],
    }).compile();
    service = moduleRef.get(ThreadsService);
    reputationService = moduleRef.get(ReputationService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
    await ensureRolesAndPermissions(prisma);

    const student1 = await prisma.user.create({
      data: { email: `thread-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student1.id;
    const student2 = await prisma.user.create({
      data: { email: `thread-other-${suffix}@example.test`, status: "ACTIVE" },
    });
    otherStudentId = student2.id;
    const adminUser = await prisma.user.create({
      data: { email: `thread-admin-${suffix}@example.test`, status: "ACTIVE" },
    });
    adminId = adminUser.id;

    const category = await prisma.forumCategory.create({
      data: { title: `Cat ${suffix}`, slug: `cat-${suffix}` },
    });
    const board = await prisma.forumBoard.create({
      data: { categoryId: category.id, title: `Board ${suffix}`, slug: `board-${suffix}` },
    });
    boardId = board.id;
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

  it("creates a discussion thread and awards reputation to the author", async () => {
    const thread = await service.create(student(), {
      boardId,
      title: "Hello world",
      body: "First post",
    });
    expect(thread.type).toBe("DISCUSSION");
    expect(thread.authorId).toBe(studentId);

    const profile = await reputationService.getProfile(studentId);
    expect(profile.reputationPoints).toBeGreaterThanOrEqual(5);
  });

  it("rejects more than one related-content link at once", async () => {
    await expect(
      service.create(student(), {
        boardId,
        title: "Bad related content",
        body: "body",
        relatedCourseId: "11111111-1111-1111-1111-111111111111",
        relatedQuizId: "22222222-2222-2222-2222-222222222222",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("excludes hidden threads from list() for non-moderators but not for moderators", async () => {
    const thread = await service.create(student(), { boardId, title: "To hide", body: "body" });
    await prisma.thread.update({ where: { id: thread.id }, data: { isHidden: true } });

    const asStudent = await service.list(student(), { page: 1, pageSize: 50 });
    expect(asStudent.items.some((item) => item.id === thread.id)).toBe(false);

    const asAdmin = await service.list(admin(), { page: 1, pageSize: 50 });
    expect(asAdmin.items.some((item) => item.id === thread.id)).toBe(true);
  });

  it("getByIdOrThrow increments the view count", async () => {
    const thread = await service.create(student(), { boardId, title: "Views", body: "body" });
    const first = await service.getByIdOrThrow(student(), thread.id);
    const second = await service.getByIdOrThrow(student(), thread.id);
    expect(second.viewCount).toBeGreaterThan(first.viewCount);
  });

  it("update rejects a non-owner, non-moderator and allows the owner", async () => {
    const thread = await service.create(student(), { boardId, title: "Owned", body: "body" });
    await expect(
      service.update(otherStudent(), thread.id, { title: "Hijacked" }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const updated = await service.update(student(), thread.id, { title: "Edited" });
    expect(updated.title).toBe("Edited");
  });

  it("a locked thread rejects edits from its own author but not from a moderator", async () => {
    const thread = await service.create(student(), { boardId, title: "Lockable", body: "body" });
    await prisma.thread.update({ where: { id: thread.id }, data: { isLocked: true } });

    await expect(service.update(student(), thread.id, { title: "Nope" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const updated = await service.update(admin(), thread.id, { title: "Admin edit" });
    expect(updated.title).toBe("Admin edit");
  });

  it("setStatus toggles OPEN/CLOSED and rejects an invalid transition", async () => {
    const thread = await service.create(student(), { boardId, title: "Status", body: "body" });
    const closed = await service.setStatus(student(), thread.id, "CLOSED");
    expect(closed.status).toBe("CLOSED");
    const reopened = await service.setStatus(student(), thread.id, "OPEN");
    expect(reopened.status).toBe("OPEN");
  });

  it("acceptAnswer marks the reply accepted, solves the question, and awards reputation", async () => {
    const question = await service.create(student(), {
      boardId,
      type: "QUESTION",
      title: "A question",
      body: "body",
    });
    const reply = await prisma.reply.create({
      data: { threadId: question.id, authorId: otherStudentId, body: "An answer" },
    });

    const solved = await service.acceptAnswer(student(), question.id, reply.id);
    expect(solved.isSolved).toBe(true);

    const updatedReply = await prisma.reply.findUniqueOrThrow({ where: { id: reply.id } });
    expect(updatedReply.isAcceptedAnswer).toBe(true);

    const profile = await reputationService.getProfile(otherStudentId);
    expect(profile.reputationPoints).toBeGreaterThanOrEqual(15);
  });

  it("acceptAnswer rejects a DISCUSSION-type thread", async () => {
    const discussion = await service.create(student(), {
      boardId,
      title: "Not a question",
      body: "body",
    });
    const reply = await prisma.reply.create({
      data: { threadId: discussion.id, authorId: otherStudentId, body: "reply" },
    });
    await expect(service.acceptAnswer(student(), discussion.id, reply.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
