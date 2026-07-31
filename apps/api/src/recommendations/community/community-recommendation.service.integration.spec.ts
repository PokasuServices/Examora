import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { CommunitySearchService } from "../../community/search/community-search.service";
import { CommunityAccessService } from "../../community/common/community-access.service";
import { PermissionsService } from "../../permissions/permissions.service";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { StudentAnalyticsService } from "../../analytics/student/student-analytics.service";
import { CatalogService } from "../../learning/catalog.service";
import { ProgressService } from "../../learning/progress.service";
import { SubmissionsService } from "../../assignments/submissions/submissions.service";
import { AssignmentCatalogService } from "../../assignments/catalog/assignment-catalog.service";
import { MalwareScanQueueService } from "../../assignments/malware-scan-queue.service";
import { STORAGE_PORT } from "../../storage/storage.port";
import { FakeStorageService } from "../../../test/support/fake-storage.service";
import {
  fakeNotificationQueueServiceProvider,
  fakeNotificationsServiceProvider,
} from "../../../test/support/fake-notifications-service";
import { RecommendationContextService } from "../recommendation-context.service";
import { CommunityRecommendationService } from "./community-recommendation.service";
import type { RequestUser } from "../../auth/types/request-user";

describe("CommunityRecommendationService (integration)", () => {
  let service: CommunityRecommendationService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let courseId: string;
  let boardId: string;
  let threadId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        CommunityRecommendationService,
        RecommendationContextService,
        CommunitySearchService,
        CommunityAccessService,
        PermissionsService,
        EnrollmentService,
        StudentAnalyticsService,
        CatalogService,
        ProgressService,
        SubmissionsService,
        AssignmentCatalogService,
        PrismaService,
        { provide: STORAGE_PORT, useClass: FakeStorageService },
        { provide: MalwareScanQueueService, useValue: { enqueue: async () => undefined } },
        fakeNotificationQueueServiceProvider(),
        fakeNotificationsServiceProvider(),
      ],
    }).compile();
    service = moduleRef.get(CommunityRecommendationService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const student = await prisma.user.create({
      data: { email: `community-rec-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student.id;

    const course = await prisma.course.create({
      data: {
        title: `Community Rec Course ${suffix}`,
        slug: `community-rec-course-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    courseId = course.id;

    const forumCategory = await prisma.forumCategory.create({
      data: { title: `Community Rec Forum ${suffix}`, slug: `community-rec-forum-${suffix}` },
    });
    const board = await prisma.forumBoard.create({
      data: {
        categoryId: forumCategory.id,
        title: `Community Rec Board ${suffix}`,
        slug: `community-rec-board-${suffix}`,
      },
    });
    boardId = board.id;

    const thread = await prisma.thread.create({
      data: {
        boardId,
        authorId: studentId,
        title: `Community Rec Course ${suffix} tips`,
        body: `Discussion about Community Rec Course ${suffix}`,
      },
    });
    threadId = thread.id;

    await prisma.enrollment.create({
      data: { userId: studentId, courseId, status: "ACTIVE", source: "FREE" },
    });
  });

  afterAll(async () => {
    await prisma.thread.deleteMany({ where: { id: threadId } });
    await prisma.forumBoard.deleteMany({ where: { id: boardId } });
    await prisma.forumCategory.deleteMany({ where: { slug: `community-rec-forum-${suffix}` } });
    await prisma.enrollment.deleteMany({ where: { userId: studentId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: studentId } });
    await moduleRef.close();
  });

  it("finds discussions whose title matches an enrolled course's title", async () => {
    const actor: RequestUser = {
      id: studentId,
      email: `community-rec-${suffix}@example.test`,
      roles: ["STUDENT"],
    };
    const recs = await service.getRelatedDiscussions(actor);
    expect(recs.some((r) => r.threadId === threadId)).toBe(true);
  });
});
