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
import { ReactionsService } from "./reactions.service";

describe("ReactionsService (integration)", () => {
  let service: ReactionsService;
  let threadsService: ThreadsService;
  let reputationService: ReputationService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let boardId: string;
  let studentId: string;
  let authorId: string;
  const suffix = `${Date.now()}`;

  const student = (): RequestUser => ({
    id: studentId,
    email: "s@example.test",
    roles: ["STUDENT"],
  });
  const author = (): RequestUser => ({ id: authorId, email: "a@example.test", roles: ["STUDENT"] });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ReactionsService,
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
    service = moduleRef.get(ReactionsService);
    threadsService = moduleRef.get(ThreadsService);
    reputationService = moduleRef.get(ReputationService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
    await ensureRolesAndPermissions(prisma);

    const student1 = await prisma.user.create({
      data: { email: `react-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student1.id;
    const author1 = await prisma.user.create({
      data: { email: `react-author-${suffix}@example.test`, status: "ACTIVE" },
    });
    authorId = author1.id;

    const category = await prisma.forumCategory.create({
      data: { title: `XCat ${suffix}`, slug: `xcat-${suffix}` },
    });
    const board = await prisma.forumBoard.create({
      data: { categoryId: category.id, title: `XBoard ${suffix}`, slug: `xboard-${suffix}` },
    });
    boardId = board.id;
  });

  afterAll(async () => {
    await prisma.reputationEvent.deleteMany({ where: { userId: { in: [studentId, authorId] } } });
    await prisma.communityProfile.deleteMany({ where: { userId: { in: [studentId, authorId] } } });
    await prisma.communityLike.deleteMany({ where: { userId: { in: [studentId, authorId] } } });
    await prisma.communityBookmark.deleteMany({ where: { userId: studentId } });
    await prisma.threadFollow.deleteMany({ where: { userId: studentId } });
    await prisma.thread.deleteMany({ where: { boardId } });
    await prisma.forumBoard.deleteMany({ where: { id: boardId } });
    await prisma.user.deleteMany({ where: { id: { in: [studentId, authorId] } } });
    await moduleRef.close();
  });

  it("toggling a like awards the author reputation, and toggling again removes it", async () => {
    const thread = await threadsService.create(author(), { boardId, title: "Likeable", body: "b" });
    const before = await reputationService.getProfile(authorId);

    const liked = await service.toggleLike(student(), "THREAD", thread.id);
    expect(liked).toEqual({ liked: true, likeCount: 1 });
    const afterLike = await reputationService.getProfile(authorId);
    expect(afterLike.reputationPoints).toBe(before.reputationPoints + 1);

    const unliked = await service.toggleLike(student(), "THREAD", thread.id);
    expect(unliked).toEqual({ liked: false, likeCount: 0 });
    const afterUnlike = await reputationService.getProfile(authorId);
    expect(afterUnlike.reputationPoints).toBe(before.reputationPoints);
  });

  it("liking your own thread does not change your own reputation", async () => {
    const thread = await threadsService.create(student(), { boardId, title: "Mine", body: "b" });
    const before = await reputationService.getProfile(studentId);
    await service.toggleLike(student(), "THREAD", thread.id);
    const after = await reputationService.getProfile(studentId);
    expect(after.reputationPoints).toBe(before.reputationPoints);
  });

  it("toggles a bookmark on and off", async () => {
    const thread = await threadsService.create(author(), {
      boardId,
      title: "Bookmarkable",
      body: "b",
    });
    expect(await service.toggleBookmark(student(), thread.id)).toEqual({ bookmarked: true });
    expect(await service.toggleBookmark(student(), thread.id)).toEqual({ bookmarked: false });
  });

  it("toggles a follow on and off", async () => {
    const thread = await threadsService.create(author(), {
      boardId,
      title: "Followable",
      body: "b",
    });
    expect(await service.toggleFollow(student(), thread.id)).toEqual({ following: true });
    expect(await service.toggleFollow(student(), thread.id)).toEqual({ following: false });
  });

  it("listBookmarkedThreadIds returns only the caller's bookmarks", async () => {
    const thread1 = await threadsService.create(author(), { boardId, title: "B1", body: "b" });
    const thread2 = await threadsService.create(author(), { boardId, title: "B2", body: "b" });
    await service.toggleBookmark(student(), thread1.id);
    await service.toggleBookmark(student(), thread2.id);

    const { threadIds, total } = await service.listBookmarkedThreadIds(student(), {
      page: 1,
      pageSize: 20,
    });
    expect(total).toBeGreaterThanOrEqual(2);
    expect(threadIds).toEqual(expect.arrayContaining([thread1.id, thread2.id]));
  });
});
