import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { AssignmentCatalogService } from "../../assignments/catalog/assignment-catalog.service";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { StudentAnalyticsService } from "../../analytics/student/student-analytics.service";
import { CatalogService } from "../../learning/catalog.service";
import { ProgressService } from "../../learning/progress.service";
import { SubmissionsService } from "../../assignments/submissions/submissions.service";
import { MalwareScanQueueService } from "../../assignments/malware-scan-queue.service";
import { STORAGE_PORT } from "../../storage/storage.port";
import { FakeStorageService } from "../../../test/support/fake-storage.service";
import {
  fakeNotificationQueueServiceProvider,
  fakeNotificationsServiceProvider,
} from "../../../test/support/fake-notifications-service";
import { RecommendationContextService } from "../recommendation-context.service";
import { AssignmentRecommendationService } from "./assignment-recommendation.service";

describe("AssignmentRecommendationService (integration)", () => {
  let service: AssignmentRecommendationService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let courseId: string;
  let assignmentId: string;
  let submittedAssignmentId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        AssignmentRecommendationService,
        RecommendationContextService,
        AssignmentCatalogService,
        EnrollmentService,
        StudentAnalyticsService,
        CatalogService,
        ProgressService,
        SubmissionsService,
        PrismaService,
        { provide: STORAGE_PORT, useClass: FakeStorageService },
        { provide: MalwareScanQueueService, useValue: { enqueue: async () => undefined } },
        fakeNotificationQueueServiceProvider(),
        fakeNotificationsServiceProvider(),
      ],
    }).compile();
    service = moduleRef.get(AssignmentRecommendationService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const student = await prisma.user.create({
      data: { email: `assignment-rec-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student.id;

    const course = await prisma.course.create({
      data: {
        title: `Assignment Rec Course ${suffix}`,
        slug: `assignment-rec-course-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    courseId = course.id;
    const subject = await prisma.subject.create({
      data: {
        courseId,
        title: "Subject",
        slug: `assignment-rec-subject-${suffix}`,
        status: "PUBLISHED",
      },
    });

    const assignment = await prisma.assignment.create({
      data: {
        subjectId: subject.id,
        title: "Recommended Assignment",
        slug: `assignment-rec-assignment-${suffix}`,
        brief: "brief",
        fileRules: { allowedMimeTypes: ["image/png"], maxFileSizeMb: 5, maxFiles: 1 },
        marksTotal: 10,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    assignmentId = assignment.id;

    const submittedAssignment = await prisma.assignment.create({
      data: {
        subjectId: subject.id,
        title: "Already Submitted Assignment",
        slug: `assignment-rec-submitted-${suffix}`,
        brief: "brief",
        fileRules: { allowedMimeTypes: ["image/png"], maxFileSizeMb: 5, maxFiles: 1 },
        marksTotal: 10,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    submittedAssignmentId = submittedAssignment.id;

    await prisma.enrollment.create({
      data: { userId: studentId, courseId, status: "ACTIVE", source: "FREE" },
    });
    await prisma.assignmentSubmission.create({
      data: {
        assignmentId: submittedAssignmentId,
        studentId,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.assignmentSubmission.deleteMany({ where: { studentId } });
    await prisma.enrollment.deleteMany({ where: { userId: studentId } });
    await prisma.assignment.deleteMany({
      where: { id: { in: [assignmentId, submittedAssignmentId] } },
    });
    await prisma.subject.deleteMany({ where: { courseId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: studentId } });
    await moduleRef.close();
  });

  it("recommends a published assignment in an enrolled course's subject, excluding already-submitted assignments", async () => {
    const recs = await service.getRecommendedAssignments(studentId);
    expect(recs.some((r) => r.assignmentId === assignmentId)).toBe(true);
    expect(recs.some((r) => r.assignmentId === submittedAssignmentId)).toBe(false);
  });
});
