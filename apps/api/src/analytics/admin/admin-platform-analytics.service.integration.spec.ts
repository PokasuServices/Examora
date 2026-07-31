import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminPlatformAnalyticsService } from "./admin-platform-analytics.service";

describe("AdminPlatformAnalyticsService (integration)", () => {
  let service: AdminPlatformAnalyticsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let courseId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [AdminPlatformAnalyticsService, PrismaService],
    }).compile();
    service = moduleRef.get(AdminPlatformAnalyticsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const studentRole = await prisma.role.upsert({
      where: { name: "STUDENT" },
      update: {},
      create: { name: "STUDENT" },
    });
    const student = await prisma.user.create({
      data: {
        email: `platform-analytics-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: studentRole.id } },
      },
    });
    studentId = student.id;

    const course = await prisma.course.create({
      data: {
        title: `Platform Analytics Course ${suffix}`,
        slug: `platform-analytics-course-${suffix}`,
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

  it("counts real users/courses/enrollments into the platform dashboard", async () => {
    const dashboard = await service.getDashboard();
    expect(dashboard.totalUsers).toBeGreaterThanOrEqual(1);
    expect(dashboard.totalStudents).toBeGreaterThanOrEqual(1);
    expect(dashboard.totalCourses).toBeGreaterThanOrEqual(1);
    expect(dashboard.publishedCourseCount).toBeGreaterThanOrEqual(1);
    expect(dashboard.totalEnrollments).toBeGreaterThanOrEqual(1);
    expect(dashboard.activeEnrollments).toBeGreaterThanOrEqual(1);
    expect(dashboard.revenueCurrency).toBe("INR");
  });

  it("buckets new-user growth by day and includes a role breakdown", async () => {
    const growth = await service.getUserGrowth(7);
    expect(growth.newUsersByDay).toHaveLength(7);
    expect(growth.newUsersByDay.reduce((s, p) => s + p.count, 0)).toBeGreaterThanOrEqual(1);
    const studentBucket = growth.usersByRole.find((r) => r.role === "STUDENT");
    expect(studentBucket?.count).toBeGreaterThanOrEqual(1);
  });
});
