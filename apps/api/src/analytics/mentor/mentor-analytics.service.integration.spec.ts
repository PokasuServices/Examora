import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { ProgressService } from "../../learning/progress.service";
import { CatalogService } from "../../learning/catalog.service";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { SubmissionsService } from "../../assignments/submissions/submissions.service";
import { AssignmentCatalogService } from "../../assignments/catalog/assignment-catalog.service";
import { MalwareScanQueueService } from "../../assignments/malware-scan-queue.service";
import { MentorAssignmentService } from "../../mentoring/assignment/mentor-assignment.service";
import { MentorProfilesService } from "../../mentoring/mentor-profiles/mentor-profiles.service";
import { STORAGE_PORT } from "../../storage/storage.port";
import { FakeStorageService } from "../../../test/support/fake-storage.service";
import {
  fakeNotificationQueueServiceProvider,
  fakeNotificationsServiceProvider,
} from "../../../test/support/fake-notifications-service";
import { StudentAnalyticsService } from "../student/student-analytics.service";
import { MentorAnalyticsService } from "./mentor-analytics.service";

describe("MentorAnalyticsService (integration)", () => {
  let service: MentorAnalyticsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let mentorId: string;
  let strangerMentorId: string;
  let studentId: string;
  let adminId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        MentorAnalyticsService,
        StudentAnalyticsService,
        ProgressService,
        CatalogService,
        SubmissionsService,
        AssignmentCatalogService,
        EnrollmentService,
        MentorAssignmentService,
        MentorProfilesService,
        PrismaService,
        { provide: STORAGE_PORT, useClass: FakeStorageService },
        { provide: MalwareScanQueueService, useValue: { enqueue: async () => undefined } },
        fakeNotificationQueueServiceProvider(),
        fakeNotificationsServiceProvider(),
      ],
    }).compile();
    service = moduleRef.get(MentorAnalyticsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const mentorRole = await prisma.role.upsert({
      where: { name: "MENTOR" },
      update: {},
      create: { name: "MENTOR" },
    });

    const mentor = await prisma.user.create({
      data: {
        email: `mentor-analytics-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: mentorRole.id } },
      },
    });
    mentorId = mentor.id;

    const strangerMentor = await prisma.user.create({
      data: {
        email: `mentor-analytics-stranger-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: mentorRole.id } },
      },
    });
    strangerMentorId = strangerMentor.id;

    const admin = await prisma.user.create({
      data: { email: `mentor-analytics-admin-${suffix}@example.test`, status: "ACTIVE" },
    });
    adminId = admin.id;

    const student = await prisma.user.create({
      data: { email: `mentor-analytics-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student.id;

    await prisma.mentorProfile.create({ data: { userId: mentorId, maxStudents: 5 } });
    await prisma.mentorAssignment.create({
      data: { studentId, mentorId, assignedById: adminId },
    });

    // A student assigned to the OTHER (stranger) mentor — must never leak
    // into this mentor's analytics.
    const otherStudent = await prisma.user.create({
      data: { email: `mentor-analytics-other-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    await prisma.mentorProfile.create({ data: { userId: strangerMentorId, maxStudents: 5 } });
    await prisma.mentorAssignment.create({
      data: { studentId: otherStudent.id, mentorId: strangerMentorId, assignedById: adminId },
    });

    await prisma.mentorTask.create({
      data: { studentId, mentorId, title: "Review draft", status: "PENDING" },
    });
  });

  afterAll(async () => {
    await prisma.mentorTask.deleteMany({
      where: { mentorId: { in: [mentorId, strangerMentorId] } },
    });
    await prisma.mentorAssignment.deleteMany({
      where: { mentorId: { in: [mentorId, strangerMentorId] } },
    });
    await prisma.mentorProfile.deleteMany({
      where: { userId: { in: [mentorId, strangerMentorId] } },
    });
    await prisma.user.deleteMany({ where: { email: { contains: `mentor-analytics-${suffix}` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `-${suffix}@example.test` } } });
    await moduleRef.close();
  });

  it("scopes the student-progress dashboard to this mentor's own students only", async () => {
    const entries = await service.getStudentProgressDashboard(mentorId);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.studentId).toBe(studentId);

    const strangerEntries = await service.getStudentProgressDashboard(strangerMentorId);
    expect(strangerEntries.every((e) => e.studentId !== studentId)).toBe(true);
  });

  it("computes workload from the real caseload and profile capacity", async () => {
    const workload = await service.getWorkload(mentorId);
    expect(workload.activeStudentCount).toBe(1);
    expect(workload.maxStudents).toBe(5);
    expect(workload.utilizationPercent).toBe(20);
    expect(workload.pendingTasksCount).toBe(1);
  });

  it("returns an empty engagement summary for a mentor with no students", async () => {
    const freshMentorRole = await prisma.role.findUniqueOrThrow({ where: { name: "MENTOR" } });
    const freshMentor = await prisma.user.create({
      data: {
        email: `mentor-analytics-fresh-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: freshMentorRole.id } },
      },
    });
    try {
      const engagement = await service.getEngagementSummary(freshMentor.id);
      expect(engagement).toEqual({
        studentsActiveLast7Days: 0,
        studentsInactive14Days: 0,
        totalStudents: 0,
      });
      const quiz = await service.getQuizPerformance(freshMentor.id);
      expect(quiz).toEqual({ studentCount: 0, averagePercentage: null, passRate: null });
    } finally {
      await prisma.user.deleteMany({ where: { id: freshMentor.id } });
    }
  });
});
