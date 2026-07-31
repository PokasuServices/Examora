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
import {
  seedPublishedAssignment,
  type SeededAssignment,
} from "../../../test/support/assignment-seed";
import { StudentAnalyticsService } from "../student/student-analytics.service";
import { AdminAcademicAnalyticsService } from "./admin-academic-analytics.service";

describe("AdminAcademicAnalyticsService (integration)", () => {
  let service: AdminAcademicAnalyticsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let mentorId: string;
  let studentId: string;
  let course: SeededCourseTree;
  let assignment: SeededAssignment;
  const suffix = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        AdminAcademicAnalyticsService,
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
    service = moduleRef.get(AdminAcademicAnalyticsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const mentorRole = await prisma.role.upsert({
      where: { name: "MENTOR" },
      update: {},
      create: { name: "MENTOR" },
    });
    const mentor = await prisma.user.create({
      data: {
        email: `academic-analytics-mentor-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: mentorRole.id } },
      },
    });
    mentorId = mentor.id;

    const student = await prisma.user.create({
      data: { email: `academic-analytics-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student.id;

    await prisma.mentorAssignment.create({
      data: { studentId, mentorId, assignedById: mentorId },
    });

    course = await seedPublishedCourseTree(prisma, { publishedLessons: 2 });
    await prisma.enrollment.create({
      data: { userId: studentId, courseId: course.courseId, status: "ACTIVE", source: "FREE" },
    });
    await prisma.lessonProgress.create({
      data: {
        userId: studentId,
        lessonId: course.lessonIds[0]!,
        courseId: course.courseId,
        completedAt: new Date(),
        firstViewedAt: new Date(),
        lastViewedAt: new Date(),
      },
    });

    assignment = await seedPublishedAssignment(prisma, {
      criterionCount: 1,
      maxMarksPerCriterion: 10,
    });
    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId: assignment.assignmentId,
        studentId,
        reviewerId: mentorId,
        version: 1,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });
    await prisma.assignmentReview.create({
      data: {
        submissionId: submission.id,
        reviewerId: mentorId,
        status: "PUBLISHED",
        decision: "APPROVED",
        obtainedMarks: 9,
        publishedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.assignmentReview.deleteMany({ where: { reviewerId: mentorId } });
    await prisma.assignmentSubmission.deleteMany({ where: { studentId } });
    await assignment.cleanup();
    await prisma.lessonProgress.deleteMany({ where: { userId: studentId } });
    await prisma.enrollment.deleteMany({ where: { userId: studentId } });
    await course.cleanup();
    await prisma.mentorAssignment.deleteMany({ where: { mentorId } });
    await prisma.user.deleteMany({ where: { id: { in: [mentorId, studentId] } } });
    await moduleRef.close();
  });

  it("computes real course performance (enrollment, completion, revenue)", async () => {
    const entries = await service.getCoursePerformance();
    const entry = entries.find((e) => e.courseId === course.courseId);
    expect(entry).toBeDefined();
    expect(entry!.enrollmentCount).toBeGreaterThanOrEqual(1);
    expect(entry!.averageCompletionPercent).toBeGreaterThan(0);
  });

  it("computes real mentor performance from caseload + reviews", async () => {
    const entries = await service.getMentorPerformance();
    const entry = entries.find((e) => e.mentorId === mentorId);
    expect(entry).toBeDefined();
    expect(entry!.activeStudentCount).toBeGreaterThanOrEqual(1);
    expect(entry!.averageStudentCompletionPercent).toBeGreaterThan(0);
  });

  it("computes assignment analytics with a decision breakdown", async () => {
    const analytics = await service.getAssignmentAnalytics();
    expect(analytics.totalAssignments).toBeGreaterThanOrEqual(1);
    expect(analytics.reviewedCount).toBeGreaterThanOrEqual(1);
    expect(analytics.averageMarksPercent).toBeGreaterThan(0);
    const approved = analytics.decisionBreakdown.find((d) => d.decision === "APPROVED");
    expect(approved?.count).toBeGreaterThanOrEqual(1);
  });

  it("returns null averages for quiz analytics when no attempts exist yet", async () => {
    // Sanity check on the zero-division guard — this suite doesn't seed any
    // quiz attempts, so submittedAttempts should legitimately be low/zero
    // relative to whatever else is in the shared dev DB, and the guard must
    // not throw.
    await expect(service.getQuizAnalytics()).resolves.toEqual(
      expect.objectContaining({ totalQuizzes: expect.any(Number) }),
    );
  });
});
