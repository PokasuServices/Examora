import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { PrismaService } from "../prisma/prisma.service";
import { seedPublishedCourseTree, type SeededCourseTree } from "../../test/support/content-seed";
import { fakeNotificationsServiceProvider } from "../../test/support/fake-notifications-service";
import { CatalogService } from "./catalog.service";

describe("CatalogService (integration)", () => {
  let service: CatalogService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let tree: SeededCourseTree;
  const userId = "00000000-0000-4000-8000-00000000c001";

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        EnrollmentService,
        PrismaService,
        fakeNotificationsServiceProvider(),
      ],
    }).compile();
    service = moduleRef.get(CatalogService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
    tree = await seedPublishedCourseTree(prisma, { publishedLessons: 2 });
  });

  afterAll(async () => {
    await tree.cleanup();
    await moduleRef.close();
  });

  it("lists the published course and 404s a draft one", async () => {
    const { items } = await service.listPublishedCourses({ page: 1, pageSize: 100 });
    expect(items.some((c) => c.id === tree.courseId)).toBe(true);

    const draft = await seedPublishedCourseTree(prisma, { courseStatus: "DRAFT" });
    await expect(service.getPublishedCourseOrThrow(draft.courseId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await draft.cleanup();
  });

  it("returns only published lessons in the curriculum (drafts excluded)", async () => {
    const { course, progressByLesson } = await service.getCurriculum(tree.courseId, userId);
    const lessons = course.subjects.flatMap((s) =>
      s.topics.flatMap((t) => t.modules.flatMap((m) => m.lessons)),
    );
    expect(lessons).toHaveLength(2);
    expect(lessons.some((l) => l.id === tree.draftLessonId)).toBe(false);
    expect(progressByLesson.size).toBe(0);
  });

  it("serves a published lesson but 404s one whose ancestor is not published", async () => {
    const result = await service.getLessonForStudent(tree.lessonIds[0]!, userId);
    expect(result.courseId).toBe(tree.courseId);

    // Unpublish the module; the (still-published) lesson must become invisible.
    await prisma.module.update({ where: { id: tree.moduleId }, data: { status: "DRAFT" } });
    await expect(service.getLessonForStudent(tree.lessonIds[0]!, userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await prisma.module.update({ where: { id: tree.moduleId }, data: { status: "PUBLISHED" } });
  });

  it("404s the draft lesson directly", async () => {
    await expect(service.getLessonForStudent(tree.draftLessonId, userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe("entitlement gate (Sprint 8, ADR-0018)", () => {
    it("rejects curriculum and lesson access for a non-entitled paid course, then allows it once enrolled", async () => {
      const student = await prisma.user.create({
        data: { email: `catalog-entitlement-${Date.now()}@example.test`, status: "ACTIVE" },
      });

      await prisma.course.update({
        where: { id: tree.courseId },
        data: { priceAmount: 999, priceCurrency: "INR" },
      });

      await expect(service.getCurriculum(tree.courseId, student.id)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.getLessonForStudent(tree.lessonIds[0]!, student.id),
      ).rejects.toBeInstanceOf(ForbiddenException);

      await prisma.enrollment.create({
        data: {
          userId: student.id,
          courseId: tree.courseId,
          status: "ACTIVE",
          source: "ADMIN_GRANT",
        },
      });
      await expect(service.getCurriculum(tree.courseId, student.id)).resolves.toBeDefined();
      await expect(
        service.getLessonForStudent(tree.lessonIds[0]!, student.id),
      ).resolves.toBeDefined();

      await prisma.enrollment.deleteMany({ where: { userId: student.id } });
      await prisma.course.update({
        where: { id: tree.courseId },
        data: { priceAmount: null },
      });
      await prisma.user.delete({ where: { id: student.id } });
    });
  });
});
