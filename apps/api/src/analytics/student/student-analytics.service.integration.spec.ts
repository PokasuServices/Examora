import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { ProgressService } from "../../learning/progress.service";
import { CatalogService } from "../../learning/catalog.service";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { SubmissionsService } from "../../assignments/submissions/submissions.service";
import { AssignmentCatalogService } from "../../assignments/catalog/assignment-catalog.service";
import { MalwareScanQueueService } from "../../assignments/malware-scan-queue.service";
import { STORAGE_PORT } from "../../storage/storage.port";
import { FakeStorageService } from "../../../test/support/fake-storage.service";
import {
  fakeNotificationQueueServiceProvider,
  fakeNotificationsServiceProvider,
} from "../../../test/support/fake-notifications-service";
import { seedPublishedCourseTree, type SeededCourseTree } from "../../../test/support/content-seed";
import { seedPublishedQuiz, type SeededQuiz } from "../../../test/support/assessment-seed";
import {
  seedPublishedAssignment,
  type SeededAssignment,
} from "../../../test/support/assignment-seed";
import { StudentAnalyticsService } from "./student-analytics.service";

describe("StudentAnalyticsService (integration)", () => {
  let service: StudentAnalyticsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let userId: string;
  let course: SeededCourseTree;
  let quiz: SeededQuiz;
  let assignment: SeededAssignment;
  const suffix = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        StudentAnalyticsService,
        ProgressService,
        CatalogService,
        SubmissionsService,
        AssignmentCatalogService,
        EnrollmentService,
        PrismaService,
        { provide: STORAGE_PORT, useClass: FakeStorageService },
        { provide: MalwareScanQueueService, useValue: { enqueue: async () => undefined } },
        fakeNotificationQueueServiceProvider(),
        fakeNotificationsServiceProvider(),
      ],
    }).compile();
    service = moduleRef.get(StudentAnalyticsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const user = await prisma.user.create({
      data: { email: `analytics-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    userId = user.id;

    course = await seedPublishedCourseTree(prisma, { publishedLessons: 4 });
    await prisma.enrollment.create({
      data: { userId, courseId: course.courseId, status: "ACTIVE", source: "FREE" },
    });
    // Complete 3 of 4 published lessons (75%).
    for (const lessonId of course.lessonIds.slice(0, 3)) {
      await prisma.lessonProgress.create({
        data: {
          userId,
          lessonId,
          courseId: course.courseId,
          completedAt: new Date(),
          firstViewedAt: new Date(),
          lastViewedAt: new Date(),
        },
      });
    }

    quiz = await seedPublishedQuiz(prisma, { questionCount: 4, marksPerQuestion: 5 });
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz.quizId,
        userId,
        status: "SUBMITTED",
        questionSnapshot: [],
        optionOrder: {},
        passingScorePercent: 40,
        negativeMarkingEnabled: false,
        negativeMarksPerWrong: 0,
        totalMarks: 20,
        obtainedMarks: 15,
        percentage: 75,
        passed: true,
        correctCount: 3,
        wrongCount: 1,
        unansweredCount: 0,
        submittedAt: new Date(),
      },
    });

    assignment = await seedPublishedAssignment(prisma, {
      criterionCount: 1,
      maxMarksPerCriterion: 10,
    });
    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId: assignment.assignmentId,
        studentId: userId,
        version: 1,
        status: "APPROVED",
        submittedAt: new Date(),
      },
    });
    await prisma.assignmentReview.create({
      data: {
        submissionId: submission.id,
        reviewerId: userId,
        status: "PUBLISHED",
        decision: "APPROVED",
        obtainedMarks: 8,
        publishedAt: new Date(),
      },
    });

    await prisma.communityProfile.create({ data: { userId, reputationPoints: 42 } });
  });

  afterAll(async () => {
    await prisma.communityProfile.deleteMany({ where: { userId } });
    await prisma.assignmentReview.deleteMany({ where: { reviewerId: userId } });
    await prisma.assignmentSubmission.deleteMany({ where: { studentId: userId } });
    await assignment.cleanup();
    await prisma.quizAttempt.deleteMany({ where: { userId } });
    await quiz.cleanup();
    await prisma.enrollment.deleteMany({ where: { userId } });
    await course.cleanup();
    await prisma.user.deleteMany({ where: { id: userId } });
    await moduleRef.close();
  });

  it("computes per-course completion from real enrollment + lesson progress", async () => {
    const entries = await service.getCourseCompletion(userId);
    const entry = entries.find((e) => e.courseId === course.courseId);
    expect(entry).toBeDefined();
    expect(entry!.totalLessons).toBe(4);
    expect(entry!.completedLessons).toBe(3);
    expect(entry!.completionPercent).toBe(75);
  });

  it("rolls per-course completion up into an overall progress summary", async () => {
    const progress = await service.getLearningProgress(userId);
    expect(progress.enrolledCourseCount).toBeGreaterThanOrEqual(1);
    expect(progress.totalLessonsCompleted).toBeGreaterThanOrEqual(3);
    expect(progress.inProgressCourseCount).toBeGreaterThanOrEqual(1);
  });

  it("summarizes quiz performance from real attempts", async () => {
    const perf = await service.getQuizPerformance(userId);
    expect(perf.attemptsSubmitted).toBeGreaterThanOrEqual(1);
    expect(perf.averagePercentage).not.toBeNull();
    expect(perf.bestPercentage).toBeGreaterThanOrEqual(75);
    expect(perf.passRate).toBeGreaterThan(0);
    expect(perf.recentAttempts[0]?.quizTitle).toBeDefined();
  });

  it("summarizes assignment performance via the reused SubmissionsService.listHistory", async () => {
    const perf = await service.getAssignmentPerformance(userId);
    expect(perf.submittedCount).toBeGreaterThanOrEqual(1);
    expect(perf.reviewedCount).toBeGreaterThanOrEqual(1);
    expect(perf.averageMarksPercent).toBe(80);
    expect(perf.recentReviews[0]?.decision).toBe("APPROVED");
  });

  it("builds a cross-domain timeline sorted newest-first", async () => {
    const timeline = await service.getTimeline(userId, 50);
    expect(timeline.length).toBeGreaterThan(0);
    const types = timeline.map((t) => t.type);
    expect(types).toContain("LESSON_COMPLETED");
    expect(types).toContain("QUIZ_SUBMITTED");
    const timestamps = timeline.map((t) => t.occurredAt);
    expect([...timestamps].sort().reverse()).toEqual(timestamps);
  });

  it("computes an activity streak that includes today", async () => {
    const activity = await service.getActivitySummary(userId);
    expect(activity.last7DaysActiveDays).toBeGreaterThanOrEqual(1);
    expect(activity.currentStreakDays).toBeGreaterThanOrEqual(1);
    expect(activity.lastActiveAt).not.toBeNull();
  });

  it("aggregates achievements across domains", async () => {
    const achievements = await service.getAchievementSummary(userId);
    expect(achievements.quizzesPassed).toBeGreaterThanOrEqual(1);
    expect(achievements.assignmentsApproved).toBeGreaterThanOrEqual(1);
    expect(achievements.reputationPoints).toBe(42);
  });

  it("returns zeroed-out summaries for a student with no activity", async () => {
    const freshUser = await prisma.user.create({
      data: { email: `analytics-fresh-${suffix}@example.test`, status: "ACTIVE" },
    });
    try {
      const progress = await service.getLearningProgress(freshUser.id);
      expect(progress.enrolledCourseCount).toBe(0);
      expect(progress.overallCompletionPercent).toBe(0);

      const quizPerf = await service.getQuizPerformance(freshUser.id);
      expect(quizPerf.attemptsSubmitted).toBe(0);
      expect(quizPerf.averagePercentage).toBeNull();
      expect(quizPerf.passRate).toBeNull();
    } finally {
      await prisma.user.deleteMany({ where: { id: freshUser.id } });
    }
  });
});
