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
import { StudentAnalyticsService } from "../student/student-analytics.service";
import { AdminAcademicAnalyticsService } from "../admin/admin-academic-analytics.service";
import { AdminEngagementAnalyticsService } from "../admin/admin-engagement-analytics.service";
import { ReportBuilderService } from "./report-builder.service";

describe("ReportBuilderService (integration)", () => {
  let service: ReportBuilderService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let courseId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ReportBuilderService,
        AdminAcademicAnalyticsService,
        AdminEngagementAnalyticsService,
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
    service = moduleRef.get(ReportBuilderService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const studentRole = await prisma.role.upsert({
      where: { name: "STUDENT" },
      update: {},
      create: { name: "STUDENT" },
    });
    const student = await prisma.user.create({
      data: {
        email: `report-builder-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: studentRole.id } },
      },
    });
    studentId = student.id;

    const course = await prisma.course.create({
      data: {
        title: `Report Builder Course ${suffix}`,
        slug: `report-builder-course-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    courseId = course.id;
    await prisma.enrollment.create({
      data: { userId: studentId, courseId, status: "ACTIVE", source: "FREE" },
    });
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { userId: studentId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: studentId } });
    await moduleRef.close();
  });

  it("builds a STUDENT_PROGRESS report with columns matching its rows", async () => {
    const report = await service.build("STUDENT_PROGRESS", { limit: 100 });
    expect(report.reportType).toBe("STUDENT_PROGRESS");
    expect(report.columns).toEqual(["studentId", "email", "activeEnrollments", "lessonsCompleted"]);
    const row = report.rows.find((r) => r.studentId === studentId);
    expect(row).toBeDefined();
    expect(row!.activeEnrollments).toBeGreaterThanOrEqual(1);
  });

  it("builds an ENROLLMENT report filtered by date range", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const report = await service.build("ENROLLMENT", { from: yesterday, to: tomorrow });
    expect(
      report.rows.some((r) => r.studentEmail === `report-builder-${suffix}@example.test`),
    ).toBe(true);
  });

  it("rejects an invalid date filter", async () => {
    await expect(service.build("ENROLLMENT", { from: "not-a-date" })).rejects.toThrow(
      "Invalid 'from' date",
    );
  });

  it("builds a COURSE_PERFORMANCE report by reusing AdminAcademicAnalyticsService", async () => {
    const report = await service.build("COURSE_PERFORMANCE");
    expect(report.columns).toContain("courseId");
    expect(report.rows.some((r) => r.courseId === courseId)).toBe(true);
  });

  it("builds a NOTIFICATION_DELIVERY report with one row per channel", async () => {
    const report = await service.build("NOTIFICATION_DELIVERY");
    expect(report.columns).toEqual([
      "channel",
      "queued",
      "delivered",
      "failed",
      "suppressed",
      "successRate",
    ]);
    expect(report.rows.length).toBeGreaterThan(0);
  });
});
