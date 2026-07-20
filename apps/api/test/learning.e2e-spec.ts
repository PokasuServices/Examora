import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { configureApp } from "../src/setup-app";
import { registerUserWithRoles } from "./support/auth-helpers";
import { ensureRolesAndPermissions } from "./support/seed-helpers";
import { seedPublishedCourseTree, type SeededCourseTree } from "./support/content-seed";

/**
 * Sprint 3 learning-engine e2e: published-only browsing, published-chain
 * lesson visibility, view/complete, progress + dashboard, and admin progress
 * RBAC — against a real Postgres instance.
 */
describe("Learning engine (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let studentToken: string;
  let studentId: string;
  let adminToken: string;
  let tree: SeededCourseTree;
  let draftCourse: SeededCourseTree;
  const suffix = `${Date.now()}`;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await ensureRolesAndPermissions(prisma);

    const student = await registerUserWithRoles(app, prisma, `s3-student-${suffix}@example.test`, [
      "STUDENT",
    ]);
    studentToken = student.accessToken;
    studentId = student.userId;
    adminToken = (
      await registerUserWithRoles(app, prisma, `s3-admin-${suffix}@example.test`, ["ADMINISTRATOR"])
    ).accessToken;

    tree = await seedPublishedCourseTree(prisma, { publishedLessons: 2 });
    draftCourse = await seedPublishedCourseTree(prisma, { courseStatus: "DRAFT" });
  });

  afterAll(async () => {
    await prisma.lessonProgress.deleteMany({ where: { userId: studentId } });
    await tree.cleanup();
    await draftCourse.cleanup();
    await prisma.user.deleteMany({ where: { email: { contains: "s3-" } } });
    await app.close();
  });

  describe("catalog (published-only)", () => {
    it("lists the published course but not the draft one", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/catalog/courses?pageSize=100")
        .set(auth(studentToken))
        .expect(200);
      const ids = res.body.data.items.map((c: { id: string }) => c.id);
      expect(ids).toContain(tree.courseId);
      expect(ids).not.toContain(draftCourse.courseId);
    });

    it("404s a draft course and serves a published one", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/catalog/courses/${draftCourse.courseId}`)
        .set(auth(studentToken))
        .expect(404);
      await request(app.getHttpServer())
        .get(`/api/v1/catalog/courses/${tree.courseId}`)
        .set(auth(studentToken))
        .expect(200);
    });

    it("returns a curriculum with only published lessons", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/catalog/courses/${tree.courseId}/curriculum`)
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.totalLessons).toBe(2);
      expect(res.body.data.completedLessons).toBe(0);
    });

    it("404s a lesson whose ancestor is not published", async () => {
      await prisma.module.update({ where: { id: tree.moduleId }, data: { status: "DRAFT" } });
      await request(app.getHttpServer())
        .get(`/api/v1/catalog/lessons/${tree.lessonIds[0]}`)
        .set(auth(studentToken))
        .expect(404);
      await prisma.module.update({ where: { id: tree.moduleId }, data: { status: "PUBLISHED" } });

      await request(app.getHttpServer())
        .get(`/api/v1/catalog/lessons/${tree.lessonIds[0]}`)
        .set(auth(studentToken))
        .expect(200);
    });

    it("requires authentication", async () => {
      await request(app.getHttpServer()).get("/api/v1/catalog/courses").expect(401);
    });
  });

  describe("view, complete, progress", () => {
    it("records a view and marks a lesson complete, reflecting 50% progress + next lesson", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/learning/lessons/${tree.lessonIds[0]}/view`)
        .set(auth(studentToken))
        .expect(204);

      await request(app.getHttpServer())
        .post(`/api/v1/learning/lessons/${tree.lessonIds[0]}/complete`)
        .set(auth(studentToken))
        .expect(201);

      const progress = await request(app.getHttpServer())
        .get(`/api/v1/learning/courses/${tree.courseId}/progress`)
        .set(auth(studentToken))
        .expect(200);
      expect(progress.body.data.completedLessons).toBe(1);
      expect(progress.body.data.percentComplete).toBe(50);
      expect(progress.body.data.nextLesson.id).toBe(tree.lessonIds[1]);
    });

    it("audits lesson completion", async () => {
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: tree.lessonIds[0], action: "learning.lesson_completed" },
      });
      expect(audit).not.toBeNull();
    });

    it("404s completing a non-published (draft) lesson", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/learning/lessons/${tree.draftLessonId}/complete`)
        .set(auth(studentToken))
        .expect(404);
    });

    it("surfaces the course in the dashboard: continue-learning + recent + stats", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/learning/dashboard")
        .set(auth(studentToken))
        .expect(200);

      expect(
        res.body.data.continueLearning.some(
          (c: { courseId: string }) => c.courseId === tree.courseId,
        ),
      ).toBe(true);
      expect(res.body.data.recentlyViewed[0].lessonId).toBe(tree.lessonIds[0]);
      expect(res.body.data.stats.lessonsCompleted).toBeGreaterThanOrEqual(1);
    });

    it("drops the course from continue-learning once fully complete", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/learning/lessons/${tree.lessonIds[1]}/complete`)
        .set(auth(studentToken))
        .expect(201);

      const res = await request(app.getHttpServer())
        .get("/api/v1/learning/continue")
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.some((c: { courseId: string }) => c.courseId === tree.courseId)).toBe(
        false,
      );
    });
  });

  describe("admin progress dashboard", () => {
    it("denies a student", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/progress/courses")
        .set(auth(studentToken))
        .expect(403);
    });

    it("reports learner + completion aggregates to an admin", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/progress/courses/${tree.courseId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.totalPublishedLessons).toBe(2);
      expect(res.body.data.learnerCount).toBeGreaterThanOrEqual(1);
      expect(res.body.data.completedLearnerCount).toBeGreaterThanOrEqual(1);
    });
  });
});
