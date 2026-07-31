import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { CatalogService } from "../../learning/catalog.service";
import { ProgressService } from "../../learning/progress.service";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { StudentAnalyticsService } from "../../analytics/student/student-analytics.service";
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
import { CourseRecommendationService } from "./course-recommendation.service";

describe("CourseRecommendationService (integration)", () => {
  let service: CourseRecommendationService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let designCourseId: string;
  let secondDesignCourseId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        CourseRecommendationService,
        RecommendationContextService,
        CatalogService,
        ProgressService,
        EnrollmentService,
        StudentAnalyticsService,
        SubmissionsService,
        AssignmentCatalogService,
        PrismaService,
        { provide: STORAGE_PORT, useClass: FakeStorageService },
        { provide: MalwareScanQueueService, useValue: { enqueue: async () => undefined } },
        fakeNotificationQueueServiceProvider(),
        fakeNotificationsServiceProvider(),
      ],
    }).compile();
    service = moduleRef.get(CourseRecommendationService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const studentRole = await prisma.role.upsert({
      where: { name: "STUDENT" },
      update: {},
      create: { name: "STUDENT" },
    });
    const student = await prisma.user.create({
      data: {
        email: `course-rec-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: studentRole.id } },
      },
    });
    studentId = student.id;

    const category = await prisma.category.create({
      data: { name: `Design ${suffix}`, slug: `course-rec-design-${suffix}` },
    });

    const designCourse = await prisma.course.create({
      data: {
        categoryId: category.id,
        title: `Design Foundations ${suffix}`,
        slug: `course-rec-design-foundations-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    designCourseId = designCourse.id;

    secondDesignCourseId = (
      await prisma.course.create({
        data: {
          categoryId: category.id,
          title: `Advanced Design ${suffix}`,
          slug: `course-rec-advanced-design-${suffix}`,
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      })
    ).id;

    const subject = await prisma.subject.create({
      data: {
        courseId: designCourseId,
        title: "Subject",
        slug: `course-rec-subject-${suffix}`,
        status: "PUBLISHED",
      },
    });
    const topic = await prisma.topic.create({
      data: {
        subjectId: subject.id,
        title: "Topic",
        slug: `course-rec-topic-${suffix}`,
        status: "PUBLISHED",
      },
    });
    const mod = await prisma.module.create({
      data: {
        topicId: topic.id,
        title: "Module",
        slug: `course-rec-module-${suffix}`,
        status: "PUBLISHED",
      },
    });
    const lesson1 = await prisma.lesson.create({
      data: {
        moduleId: mod.id,
        title: "Lesson 1",
        slug: `course-rec-lesson-1-${suffix}`,
        status: "PUBLISHED",
        body: "content",
      },
    });
    await prisma.lesson.create({
      data: {
        moduleId: mod.id,
        title: "Lesson 2",
        slug: `course-rec-lesson-2-${suffix}`,
        status: "PUBLISHED",
        body: "content",
      },
    });

    await prisma.enrollment.create({
      data: { userId: studentId, courseId: designCourseId, status: "ACTIVE", source: "FREE" },
    });
    await prisma.lessonProgress.create({
      data: {
        userId: studentId,
        lessonId: lesson1.id,
        courseId: designCourseId,
        completedAt: new Date(),
        firstViewedAt: new Date(),
        lastViewedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.lessonProgress.deleteMany({ where: { userId: studentId } });
    await prisma.enrollment.deleteMany({ where: { userId: studentId } });
    await prisma.lesson.deleteMany({
      where: { module: { topic: { subject: { courseId: designCourseId } } } },
    });
    await prisma.module.deleteMany({ where: { topic: { subject: { courseId: designCourseId } } } });
    await prisma.topic.deleteMany({ where: { subject: { courseId: designCourseId } } });
    await prisma.subject.deleteMany({ where: { courseId: designCourseId } });
    await prisma.course.deleteMany({
      where: { id: { in: [designCourseId, secondDesignCourseId] } },
    });
    await prisma.category.deleteMany({ where: { slug: `course-rec-design-${suffix}` } });
    await prisma.user.deleteMany({ where: { id: studentId } });
    await moduleRef.close();
  });

  it("continue learning delegates to ProgressService.listContinueLearning with a score and reason", async () => {
    const items = await service.getContinueLearning(studentId);
    const entry = items.find((i) => i.courseId === designCourseId);
    expect(entry).toBeDefined();
    expect(entry!.completionPercent).toBe(50);
    expect(entry!.score).toBeGreaterThan(0);
    expect(entry!.reason).toContain("50%");
  });

  it("recommends a course in the same category the student is already active in, excluding enrolled courses", async () => {
    const recs = await service.getRecommendedCourses(studentId);
    const rec = recs.find((r) => r.courseId === secondDesignCourseId);
    expect(rec).toBeDefined();
    expect(recs.some((r) => r.courseId === designCourseId)).toBe(false);
  });

  it("similar courses defaults to the most-active enrollment and excludes the reference course itself", async () => {
    const similar = await service.getSimilarCourses(studentId);
    expect(similar.every((s) => s.courseId !== designCourseId)).toBe(true);
    expect(similar.some((s) => s.courseId === secondDesignCourseId)).toBe(true);
  });

  it("similar courses accepts an explicit reference course id", async () => {
    const similar = await service.getSimilarCourses(studentId, designCourseId);
    expect(similar.every((s) => s.referenceCourseId === designCourseId)).toBe(true);
  });
});
