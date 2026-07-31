import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { QuizCatalogService } from "../../assessment/quiz-catalog/quiz-catalog.service";
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
import { QuizRecommendationService } from "./quiz-recommendation.service";

describe("QuizRecommendationService (integration)", () => {
  let service: QuizRecommendationService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let courseId: string;
  let quizId: string;
  let attemptedQuizId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        QuizRecommendationService,
        RecommendationContextService,
        QuizCatalogService,
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
    service = moduleRef.get(QuizRecommendationService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const student = await prisma.user.create({
      data: { email: `quiz-rec-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student.id;

    const course = await prisma.course.create({
      data: {
        title: `Quiz Rec Course ${suffix}`,
        slug: `quiz-rec-course-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    courseId = course.id;
    const subject = await prisma.subject.create({
      data: { courseId, title: "Subject", slug: `quiz-rec-subject-${suffix}`, status: "PUBLISHED" },
    });

    const quiz = await prisma.quiz.create({
      data: {
        subjectId: subject.id,
        title: "Recommended Quiz",
        slug: `quiz-rec-quiz-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    quizId = quiz.id;

    const attempted = await prisma.quiz.create({
      data: {
        subjectId: subject.id,
        title: "Already Attempted Quiz",
        slug: `quiz-rec-attempted-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    attemptedQuizId = attempted.id;

    await prisma.enrollment.create({
      data: { userId: studentId, courseId, status: "ACTIVE", source: "FREE" },
    });
    await prisma.quizAttempt.create({
      data: {
        userId: studentId,
        quizId: attemptedQuizId,
        status: "SUBMITTED",
        questionSnapshot: [],
        optionOrder: {},
        passingScorePercent: 40,
        negativeMarkingEnabled: false,
        negativeMarksPerWrong: 0,
        totalMarks: 10,
      },
    });
  });

  afterAll(async () => {
    await prisma.quizAttempt.deleteMany({ where: { userId: studentId } });
    await prisma.enrollment.deleteMany({ where: { userId: studentId } });
    await prisma.quiz.deleteMany({ where: { id: { in: [quizId, attemptedQuizId] } } });
    await prisma.subject.deleteMany({ where: { courseId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: studentId } });
    await moduleRef.close();
  });

  it("recommends a published quiz in an enrolled course's subject, excluding already-attempted quizzes", async () => {
    const recs = await service.getRecommendedQuizzes(studentId);
    expect(recs.some((r) => r.quizId === quizId)).toBe(true);
    expect(recs.some((r) => r.quizId === attemptedQuizId)).toBe(false);
    const rec = recs.find((r) => r.quizId === quizId);
    expect(rec!.score).toBeGreaterThan(0);
    expect(rec!.reason.length).toBeGreaterThan(0);
  });
});
