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
import { RepliesService } from "../replies/replies.service";
import { ReputationService } from "../reputation/reputation.service";
import { ThreadsService } from "../threads/threads.service";
import { CommunityReportsService } from "./community-reports.service";

describe("CommunityReportsService (integration)", () => {
  let service: CommunityReportsService;
  let threadsService: ThreadsService;
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
        CommunityReportsService,
        ThreadsService,
        RepliesService,
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
    service = moduleRef.get(CommunityReportsService);
    threadsService = moduleRef.get(ThreadsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
    await ensureRolesAndPermissions(prisma);

    const adminUser = await prisma.user.create({
      data: { email: `report-admin-${suffix}@example.test`, status: "ACTIVE" },
    });
    adminId = adminUser.id;
    const studentUser = await prisma.user.create({
      data: { email: `report-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = studentUser.id;

    const category = await prisma.forumCategory.create({
      data: { title: `RepCat ${suffix}`, slug: `repcat-${suffix}` },
    });
    const board = await prisma.forumBoard.create({
      data: { categoryId: category.id, title: `RepBoard ${suffix}`, slug: `repboard-${suffix}` },
    });
    boardId = board.id;
  });

  afterAll(async () => {
    await prisma.communityReport.deleteMany({ where: { reporterId: studentId } });
    await prisma.thread.deleteMany({ where: { boardId } });
    await prisma.forumBoard.deleteMany({ where: { id: boardId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, studentId] } } });
    await moduleRef.close();
  });

  it("creates a report in PENDING status", async () => {
    const thread = await threadsService.create(admin(), {
      boardId,
      title: "Reportable",
      body: "b",
    });
    const report = await service.create(student(), "THREAD", thread.id, "Inappropriate content");
    expect(report.status).toBe("PENDING");
    expect(report.reporterId).toBe(studentId);
  });

  it("listQueue filters by status and resolves a target preview", async () => {
    const thread = await threadsService.create(admin(), {
      boardId,
      title: "Preview me",
      body: "b",
    });
    await service.create(student(), "THREAD", thread.id, "Reason");

    const { items } = await service.listQueue({ page: 1, pageSize: 50, status: "PENDING" });
    const match = items.find((item) => item.targetId === thread.id);
    expect(match).toBeDefined();
    expect(match?.targetPreview).toBe("Preview me");
  });

  it("review marks a report reviewed and records the reviewer", async () => {
    const thread = await threadsService.create(admin(), { boardId, title: "To review", body: "b" });
    const report = await service.create(student(), "THREAD", thread.id, "Reason");

    const reviewed = await service.review(admin(), report.id, "REVIEWED");
    expect(reviewed.status).toBe("REVIEWED");
    expect(reviewed.reviewedById).toBe(adminId);
    expect(reviewed.reviewedAt).not.toBeNull();
  });
});
