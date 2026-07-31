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
 * Sprint 11 AI Recommendation Engine e2e (ADR-0021): role-scoped student
 * recommendations (recommendations:read:own) and admin feature-flag
 * management (recommendations:admin) — against real seeded enrollment/
 * lesson-progress/quiz/assignment/community/mentor-feedback data.
 */
describe("AI Recommendation Engine (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  let studentId: string;
  let mentorId: string;
  const suffix = `${Date.now()}`;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let courseId: string;
  let categoryId: string;
  let secondCourseId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await ensureRolesAndPermissions(prisma);

    const admin = await registerUserWithRoles(app, prisma, `s11-admin-${suffix}@example.test`, [
      "ADMINISTRATOR",
    ]);
    adminToken = admin.accessToken;
    const student = await registerUserWithRoles(app, prisma, `s11-student-${suffix}@example.test`, [
      "STUDENT",
    ]);
    studentToken = student.accessToken;
    studentId = student.userId;
    const mentor = await registerUserWithRoles(app, prisma, `s11-mentor-${suffix}@example.test`, [
      "MENTOR",
    ]);
    mentorId = mentor.userId;

    const category = await prisma.category.create({
      data: { name: `s11-cat-${suffix}`, slug: `s11-cat-${suffix}` },
    });
    categoryId = category.id;
    const course = await prisma.course.create({
      data: {
        categoryId,
        title: `S11 Recommendation Course ${suffix}`,
        slug: `s11-recommendation-course-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    courseId = course.id;
    secondCourseId = (
      await prisma.course.create({
        data: {
          categoryId,
          title: `S11 Second Course ${suffix}`,
          slug: `s11-second-course-${suffix}`,
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      })
    ).id;

    const subject = await prisma.subject.create({
      data: { courseId, title: "Subject", slug: `s11-subject-${suffix}`, status: "PUBLISHED" },
    });
    const topic = await prisma.topic.create({
      data: {
        subjectId: subject.id,
        title: "Topic",
        slug: `s11-topic-${suffix}`,
        status: "PUBLISHED",
      },
    });
    const mod = await prisma.module.create({
      data: {
        topicId: topic.id,
        title: "Module",
        slug: `s11-module-${suffix}`,
        status: "PUBLISHED",
      },
    });
    const lesson = await prisma.lesson.create({
      data: {
        moduleId: mod.id,
        title: "Lesson",
        slug: `s11-lesson-${suffix}`,
        status: "PUBLISHED",
        body: "content",
      },
    });
    // A second, never-viewed lesson keeps completion below 100% so the course
    // still qualifies for "Continue Learning" (started but not finished).
    await prisma.lesson.create({
      data: {
        moduleId: mod.id,
        title: "Lesson 2",
        slug: `s11-lesson-2-${suffix}`,
        status: "PUBLISHED",
        body: "content",
      },
    });
    await prisma.quiz.create({
      data: {
        subjectId: subject.id,
        title: `S11 Quiz ${suffix}`,
        slug: `s11-quiz-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    await prisma.assignment.create({
      data: {
        subjectId: subject.id,
        title: `S11 Assignment ${suffix}`,
        slug: `s11-assignment-${suffix}`,
        brief: "brief",
        fileRules: { allowedMimeTypes: ["image/png"], maxFileSizeMb: 5, maxFiles: 1 },
        marksTotal: 10,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    const forumCategory = await prisma.forumCategory.create({
      data: { title: `S11 Forum ${suffix}`, slug: `s11-forum-${suffix}` },
    });
    const board = await prisma.forumBoard.create({
      data: {
        categoryId: forumCategory.id,
        title: `S11 Board ${suffix}`,
        slug: `s11-board-${suffix}`,
      },
    });
    await prisma.thread.create({
      data: {
        boardId: board.id,
        authorId: studentId,
        title: `S11 Recommendation Course ${suffix} discussion`,
        body: "body",
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

    await prisma.mentorProfile.create({ data: { userId: mentorId, maxStudents: 5 } });
    await prisma.mentorFeedback.create({
      data: { studentId, mentorId, body: "Great progress on your recent lessons!" },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.mentorFeedback.deleteMany({ where: { studentId } });
    await prisma.mentorProfile.deleteMany({ where: { userId: mentorId } });
    await prisma.thread.deleteMany({ where: { authorId: studentId } });
    await prisma.forumBoard.deleteMany({ where: { slug: `s11-board-${suffix}` } });
    await prisma.forumCategory.deleteMany({ where: { slug: `s11-forum-${suffix}` } });
    await prisma.lessonProgress.deleteMany({ where: { userId: studentId } });
    await prisma.enrollment.deleteMany({ where: { userId: studentId } });
    await prisma.recommendationFeatureFlag.deleteMany({});
    await prisma.assignment.deleteMany({ where: { slug: `s11-assignment-${suffix}` } });
    await prisma.quiz.deleteMany({ where: { slug: `s11-quiz-${suffix}` } });
    await prisma.course.deleteMany({ where: { id: { in: [courseId, secondCourseId] } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { email: { contains: "s11-" } } });
    await app.close();
  });

  describe("RBAC", () => {
    it("denies unauthenticated access to every recommendation surface", async () => {
      await request(app.getHttpServer()).get("/api/v1/recommendations/me/courses").expect(401);
      await request(app.getHttpServer())
        .get("/api/v1/admin/recommendations/feature-flags")
        .expect(401);
    });

    it("denies a student the admin feature-flag routes", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/recommendations/feature-flags")
        .set(auth(studentToken))
        .expect(403);
      await request(app.getHttpServer())
        .patch("/api/v1/admin/recommendations/feature-flags/COURSE")
        .set(auth(studentToken))
        .send({ isEnabled: false })
        .expect(403);
    });
  });

  describe("student recommendations (own data)", () => {
    it("continue learning reflects real enrollment + completed lesson progress", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/recommendations/me/continue-learning")
        .set(auth(studentToken))
        .expect(200);
      const entry = res.body.data.find((e: { courseId: string }) => e.courseId === courseId);
      expect(entry).toBeDefined();
      expect(entry.score).toBeGreaterThan(0);
      expect(entry.reason.length).toBeGreaterThan(0);
    });

    it("boosts continue-learning with a mentor-feedback signal in the reason", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/recommendations/me/continue-learning")
        .set(auth(studentToken))
        .expect(200);
      const entry = res.body.data.find((e: { courseId: string }) => e.courseId === courseId);
      expect(entry.reason).toContain("mentor left recent feedback");
    });

    it("recommends a course in the same category, excluding already-enrolled courses", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/recommendations/me/courses")
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.some((c: { courseId: string }) => c.courseId === secondCourseId)).toBe(
        true,
      );
      expect(res.body.data.some((c: { courseId: string }) => c.courseId === courseId)).toBe(false);
    });

    it("similar courses defaults to the caller's most-active enrollment", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/recommendations/me/similar-courses")
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.some((c: { courseId: string }) => c.courseId === secondCourseId)).toBe(
        true,
      );
    });

    it("recommends a quiz tied to the enrolled course's subject", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/recommendations/me/quizzes")
        .set(auth(studentToken))
        .expect(200);
      expect(
        res.body.data.some((q: { quizTitle: string }) => q.quizTitle === `S11 Quiz ${suffix}`),
      ).toBe(true);
    });

    it("recommends an assignment tied to the enrolled course's subject", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/recommendations/me/assignments")
        .set(auth(studentToken))
        .expect(200);
      expect(
        res.body.data.some(
          (a: { assignmentTitle: string }) => a.assignmentTitle === `S11 Assignment ${suffix}`,
        ),
      ).toBe(true);
    });

    it("surfaces a related community discussion for the enrolled course", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/recommendations/me/community-discussions")
        .set(auth(studentToken))
        .expect(200);
      expect(
        res.body.data.some((d: { threadTitle: string }) =>
          d.threadTitle.includes(`S11 Recommendation Course ${suffix}`),
        ),
      ).toBe(true);
    });
  });

  describe("admin feature flags", () => {
    it("lists every recommendation type defaulting to enabled", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/recommendations/feature-flags")
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data).toHaveLength(7);
      expect(res.body.data.every((f: { isEnabled: boolean }) => f.isEnabled)).toBe(true);
    });

    it("disabling a type is reflected immediately in the student endpoint (fails closed to an empty list)", async () => {
      await request(app.getHttpServer())
        .patch("/api/v1/admin/recommendations/feature-flags/COURSE")
        .set(auth(adminToken))
        .send({ isEnabled: false })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get("/api/v1/recommendations/me/courses")
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data).toEqual([]);

      await request(app.getHttpServer())
        .patch("/api/v1/admin/recommendations/feature-flags/COURSE")
        .set(auth(adminToken))
        .send({ isEnabled: true })
        .expect(200);
    });

    it("rejects an unknown recommendation type", async () => {
      await request(app.getHttpServer())
        .patch("/api/v1/admin/recommendations/feature-flags/NOT_A_REAL_TYPE")
        .set(auth(adminToken))
        .send({ isEnabled: false })
        .expect(400);
    });
  });
});
