import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { configureApp } from "../src/setup-app";
import { registerUserWithRoles } from "./support/auth-helpers";
import { ensureRolesAndPermissions } from "./support/seed-helpers";

/**
 * Sprint 10 Analytics & Reporting e2e (ADR-0020): role-scoped dashboards
 * (analytics:read:own/analytics:mentor/analytics:admin), the report
 * builder's on-demand CSV/PDF export, and scheduled-reports CRUD + run-now
 * — against real seeded enrollment/lesson-progress/quiz-attempt/assignment-
 * review/mentor-assignment data.
 */
describe("Analytics & Reporting (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let adminId: string;
  let studentToken: string;
  let studentId: string;
  let mentorToken: string;
  let mentorId: string;
  const suffix = `${Date.now()}`;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let courseId: string;
  let categoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await ensureRolesAndPermissions(prisma);

    const admin = await registerUserWithRoles(app, prisma, `s10-admin-${suffix}@example.test`, [
      "ADMINISTRATOR",
    ]);
    adminToken = admin.accessToken;
    adminId = admin.userId;
    const student = await registerUserWithRoles(app, prisma, `s10-student-${suffix}@example.test`, [
      "STUDENT",
    ]);
    studentToken = student.accessToken;
    studentId = student.userId;
    const mentor = await registerUserWithRoles(app, prisma, `s10-mentor-${suffix}@example.test`, [
      "MENTOR",
    ]);
    mentorToken = mentor.accessToken;
    mentorId = mentor.userId;

    // Seed a published course + lesson directly (mirrors commerce.e2e-spec.ts's
    // precedent of seeding prerequisite content via Prisma), enroll the
    // student, and record one completed lesson.
    const category = await prisma.category.create({
      data: { name: `s10-cat-${suffix}`, slug: `s10-cat-${suffix}` },
    });
    categoryId = category.id;
    const course = await prisma.course.create({
      data: {
        categoryId,
        title: `S10 Analytics Course ${suffix}`,
        slug: `s10-analytics-course-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    courseId = course.id;
    const subject = await prisma.subject.create({
      data: { courseId, title: "Subject", slug: `s10-subject-${suffix}`, status: "PUBLISHED" },
    });
    const topic = await prisma.topic.create({
      data: {
        subjectId: subject.id,
        title: "Topic",
        slug: `s10-topic-${suffix}`,
        status: "PUBLISHED",
      },
    });
    const mod = await prisma.module.create({
      data: {
        topicId: topic.id,
        title: "Module",
        slug: `s10-module-${suffix}`,
        status: "PUBLISHED",
      },
    });
    const lesson = await prisma.lesson.create({
      data: {
        moduleId: mod.id,
        title: "Lesson",
        slug: `s10-lesson-${suffix}`,
        status: "PUBLISHED",
        body: "content",
      },
    });

    await prisma.enrollment.create({
      data: { userId: studentId, courseId, status: "ACTIVE", source: "FREE" },
    });
    await prisma.lessonProgress.create({
      data: {
        userId: studentId,
        lessonId: lesson.id,
        courseId,
        completedAt: new Date(),
        firstViewedAt: new Date(),
        lastViewedAt: new Date(),
      },
    });

    // Assign the student to the mentor.
    await prisma.mentorProfile.create({ data: { userId: mentorId, maxStudents: 5 } });
    await prisma.mentorAssignment.create({
      data: { studentId, mentorId, assignedById: adminId },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.mentorAssignment.deleteMany({ where: { mentorId } });
    await prisma.mentorProfile.deleteMany({ where: { userId: mentorId } });
    await prisma.lessonProgress.deleteMany({ where: { userId: studentId } });
    await prisma.enrollment.deleteMany({ where: { userId: studentId } });
    await prisma.scheduledReport.deleteMany({
      where: { createdBy: { email: { contains: "s10-" } } },
    });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { email: { contains: "s10-" } } });
    await app.close();
  });

  describe("RBAC", () => {
    it("denies unauthenticated access to every analytics surface", async () => {
      await request(app.getHttpServer()).get("/api/v1/analytics/me/progress").expect(401);
      await request(app.getHttpServer()).get("/api/v1/analytics/mentor/workload").expect(401);
      await request(app.getHttpServer()).get("/api/v1/admin/analytics/platform").expect(401);
    });

    it("denies a student the mentor and admin analytics routes", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/analytics/mentor/workload")
        .set(auth(studentToken))
        .expect(403);
      await request(app.getHttpServer())
        .get("/api/v1/admin/analytics/platform")
        .set(auth(studentToken))
        .expect(403);
      await request(app.getHttpServer())
        .get("/api/v1/admin/reports/run?reportType=ENROLLMENT")
        .set(auth(studentToken))
        .expect(403);
    });

    it("denies a mentor the admin-only analytics routes", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/analytics/platform")
        .set(auth(mentorToken))
        .expect(403);
    });
  });

  describe("student analytics (own data)", () => {
    it("reflects real enrollment + completed lesson in the progress summary", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/me/progress")
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.enrolledCourseCount).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalLessonsCompleted).toBeGreaterThanOrEqual(1);
    });

    it("breaks completion down per course", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/me/course-completion")
        .set(auth(studentToken))
        .expect(200);
      const entry = res.body.data.find((e: { courseId: string }) => e.courseId === courseId);
      expect(entry).toBeDefined();
      expect(entry.completedLessons).toBe(1);
      expect(entry.completionPercent).toBe(100);
    });

    it("returns zeroed-out quiz performance when the student has no attempts", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/me/quiz-performance")
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.attemptsSubmitted).toBe(0);
      expect(res.body.data.averagePercentage).toBeNull();
    });

    it("includes the enrollment in the learning timeline", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/me/timeline")
        .set(auth(studentToken))
        .expect(200);
      const types = res.body.data.map((t: { type: string }) => t.type);
      expect(types).toContain("COURSE_ENROLLED");
      expect(types).toContain("LESSON_COMPLETED");
    });

    it("reports at least one active day and a streak", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/me/activity")
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.last7DaysActiveDays).toBeGreaterThanOrEqual(1);
      expect(res.body.data.currentStreakDays).toBeGreaterThanOrEqual(1);
    });

    it("returns an achievement summary", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/analytics/me/achievements")
        .set(auth(studentToken))
        .expect(200);
    });
  });

  describe("mentor analytics (own students only)", () => {
    it("shows the assigned student in the mentor's own dashboard", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/mentor/student-progress")
        .set(auth(mentorToken))
        .expect(200);
      expect(res.body.data.some((s: { studentId: string }) => s.studentId === studentId)).toBe(
        true,
      );
    });

    it("computes workload from the real caseload", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/analytics/mentor/workload")
        .set(auth(mentorToken))
        .expect(200);
      expect(res.body.data.activeStudentCount).toBeGreaterThanOrEqual(1);
      expect(res.body.data.maxStudents).toBe(5);
    });
  });

  describe("admin analytics", () => {
    it("reflects real platform counts", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/analytics/platform")
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.totalStudents).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalCourses).toBeGreaterThanOrEqual(1);
    });

    it("reflects real enrollment analytics", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/analytics/enrollment")
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.activeEnrollments).toBeGreaterThanOrEqual(1);
    });

    it("reflects real course performance", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/analytics/course-performance")
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.some((c: { courseId: string }) => c.courseId === courseId)).toBe(true);
    });
  });

  describe("report builder + export", () => {
    it("runs a report and returns tabular JSON", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/reports/run?reportType=STUDENT_PROGRESS")
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.columns).toContain("studentId");
      expect(Array.isArray(res.body.data.rows)).toBe(true);
    });

    it("exports a report as a downloadable CSV file", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/reports/export?reportType=ENROLLMENT&format=CSV")
        .set(auth(adminToken))
        .expect(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(res.text.split("\n")[0]).toContain("enrollmentId");
    });

    it("exports a report as a downloadable PDF file", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/reports/export?reportType=ENROLLMENT&format=PDF")
        .set(auth(adminToken))
        .expect(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(Number(res.headers["content-length"])).toBeGreaterThan(100);
    });

    it("rejects an unknown report type", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/reports/run?reportType=NOT_A_REAL_TYPE")
        .set(auth(adminToken))
        .expect(422);
    });
  });

  describe("scheduled reports", () => {
    let scheduledReportId: string;

    it("creates a scheduled report", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/admin/reports/scheduled")
        .set(auth(adminToken))
        .send({
          name: "Weekly enrollment digest",
          reportType: "ENROLLMENT",
          format: "CSV",
          cadence: "WEEKLY",
        })
        .expect(201);
      scheduledReportId = res.body.data.id;
      expect(res.body.data.isActive).toBe(true);
    });

    it("lists scheduled reports including the one just created", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/reports/scheduled")
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.some((r: { id: string }) => r.id === scheduledReportId)).toBe(true);
    });

    it("deactivates and reactivates a scheduled report", async () => {
      const deactivated = await request(app.getHttpServer())
        .patch(`/api/v1/admin/reports/scheduled/${scheduledReportId}/active`)
        .set(auth(adminToken))
        .send({ isActive: false })
        .expect(200);
      expect(deactivated.body.data.isActive).toBe(false);

      const reactivated = await request(app.getHttpServer())
        .patch(`/api/v1/admin/reports/scheduled/${scheduledReportId}/active`)
        .set(auth(adminToken))
        .send({ isActive: true })
        .expect(200);
      expect(reactivated.body.data.isActive).toBe(true);
    });

    it("fires the scheduled report's job immediately via run-now, which notifies the owner", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/reports/scheduled/${scheduledReportId}/run-now`)
        .set(auth(adminToken))
        .expect(201);

      const deadline = Date.now() + 10_000;
      let notification = null;
      while (Date.now() < deadline) {
        notification = await prisma.notification.findFirst({
          where: { eventType: "analytics.scheduled_report_ready" },
          orderBy: { createdAt: "desc" },
        });
        if (notification) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      expect(notification).not.toBeNull();
    }, 15_000);

    it("deletes a scheduled report", async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/admin/reports/scheduled/${scheduledReportId}`)
        .set(auth(adminToken))
        .expect(204);

      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/reports/scheduled")
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.some((r: { id: string }) => r.id === scheduledReportId)).toBe(false);
    });
  });
});
