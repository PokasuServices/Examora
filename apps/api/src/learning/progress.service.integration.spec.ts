import { Test, type TestingModule } from "@nestjs/testing";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { PrismaService } from "../prisma/prisma.service";
import { seedPublishedCourseTree, type SeededCourseTree } from "../../test/support/content-seed";
import { fakeNotificationsServiceProvider } from "../../test/support/fake-notifications-service";
import { CatalogService } from "./catalog.service";
import { ProgressService } from "./progress.service";

describe("ProgressService (integration)", () => {
  let progress: ProgressService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let tree: SeededCourseTree;
  let userId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ProgressService,
        CatalogService,
        EnrollmentService,
        PrismaService,
        fakeNotificationsServiceProvider(),
      ],
    }).compile();
    progress = moduleRef.get(ProgressService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    // LessonProgress has a FK to users, so the learner must actually exist.
    const learner = await prisma.user.create({
      data: { email: `progress-int-${Date.now()}@example.test`, status: "ACTIVE" },
    });
    userId = learner.id;
    tree = await seedPublishedCourseTree(prisma, { publishedLessons: 2 });
  });

  afterAll(async () => {
    await prisma.lessonProgress.deleteMany({ where: { userId } });
    await tree.cleanup();
    await prisma.user.deleteMany({ where: { id: userId } });
    await moduleRef.close();
  });

  it("records a view (creating a progress row scoped to the course)", async () => {
    await progress.recordView(userId, tree.lessonIds[0]!);
    const row = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId: tree.lessonIds[0]! } },
    });
    expect(row?.courseId).toBe(tree.courseId);
    expect(row?.completedAt).toBeNull();
  });

  it("computes 0% then 50% then 100% as lessons are completed, with the right nextLesson", async () => {
    const before = await progress.getCourseProgress(userId, tree.courseId);
    expect(before.completedLessons).toBe(0);
    expect(before.percentComplete).toBe(0);
    expect(before.nextLesson?.id).toBe(tree.lessonIds[0]);

    await progress.complete(userId, tree.lessonIds[0]!);
    const half = await progress.getCourseProgress(userId, tree.courseId);
    expect(half.completedLessons).toBe(1);
    expect(half.percentComplete).toBe(50);
    expect(half.nextLesson?.id).toBe(tree.lessonIds[1]);

    await progress.complete(userId, tree.lessonIds[1]!);
    const full = await progress.getCourseProgress(userId, tree.courseId);
    expect(full.percentComplete).toBe(100);
    expect(full.nextLesson).toBeNull();
  });

  it("treats completion as idempotent", async () => {
    const result = await progress.complete(userId, tree.lessonIds[0]!);
    expect(result.alreadyComplete).toBe(true);
  });

  it("excludes fully-completed courses from continue-learning", async () => {
    const continuing = await progress.listContinueLearning(userId);
    expect(continuing.some((c) => c.courseId === tree.courseId)).toBe(false);
  });

  it("includes a partially-complete course in continue-learning", async () => {
    const other = await seedPublishedCourseTree(prisma, { publishedLessons: 3 });
    await progress.complete(userId, other.lessonIds[0]!);

    const continuing = await progress.listContinueLearning(userId);
    const entry = continuing.find((c) => c.courseId === other.courseId);
    expect(entry?.percentComplete).toBe(33);

    await prisma.lessonProgress.deleteMany({ where: { userId, courseId: other.courseId } });
    await other.cleanup();
  });

  it("lists recently viewed lessons most-recent first", async () => {
    await progress.recordView(userId, tree.lessonIds[1]!);
    const recent = await progress.listRecentlyViewed(userId, 10);
    expect(recent[0]?.lessonId).toBe(tree.lessonIds[1]);
    expect(recent.every((r) => r.courseId === tree.courseId)).toBe(true);
  });

  it("summarises stats in the dashboard", async () => {
    const dashboard = await progress.getDashboard(userId);
    expect(dashboard.stats.lessonsCompleted).toBeGreaterThanOrEqual(2);
    expect(dashboard.stats.coursesStarted).toBeGreaterThanOrEqual(1);
    expect(dashboard.recentlyViewed.length).toBeGreaterThan(0);
  });
});
