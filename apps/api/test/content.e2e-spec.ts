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
 * Sprint 2 content-management e2e: full Category > Course > Subject > Topic >
 * Module > Lesson CRUD, status transitions, RBAC (content:manage /
 * content:publish), validation and audit — against a real Postgres instance.
 */
describe("Content management (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  const suffix = `${Date.now()}`;
  const createdCategoryIds: string[] = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await ensureRolesAndPermissions(prisma);

    adminToken = (
      await registerUserWithRoles(app, prisma, `s2-admin-${suffix}@example.test`, ["ADMINISTRATOR"])
    ).accessToken;
    studentToken = (
      await registerUserWithRoles(app, prisma, `s2-student-${suffix}@example.test`, ["STUDENT"])
    ).accessToken;
  });

  afterAll(async () => {
    // Cascade removes the whole subtree under each category's courses.
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.user.deleteMany({ where: { email: { contains: `s2-` } } });
    await app.close();
  });

  describe("RBAC", () => {
    it("denies a student creating a category", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/admin/content/categories")
        .set(auth(studentToken))
        .send({ name: "Nope" })
        .expect(403);
    });

    it("denies an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/api/v1/admin/content/courses").expect(401);
    });
  });

  describe("Category CRUD", () => {
    it("creates, reads, updates and lists a category", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/admin/content/categories")
        .set(auth(adminToken))
        .send({ name: `Design ${suffix}` })
        .expect(201);
      const id = created.body.data.id;
      createdCategoryIds.push(id);
      expect(created.body.data.slug).toMatch(/^design-/);

      await request(app.getHttpServer())
        .get(`/api/v1/admin/content/categories/${id}`)
        .set(auth(adminToken))
        .expect(200);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/admin/content/categories/${id}`)
        .set(auth(adminToken))
        .send({ description: "Design entrance exams", isActive: false })
        .expect(200);
      expect(updated.body.data.description).toBe("Design entrance exams");
      expect(updated.body.data.isActive).toBe(false);

      // Persistence is confirmed deterministically by re-fetching the row.
      const refetched = await request(app.getHttpServer())
        .get(`/api/v1/admin/content/categories/${id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(refetched.body.data.isActive).toBe(false);

      // The isActive filter returns only inactive rows (avoid asserting our
      // specific row is on a given page — ordering/pagination over a shared
      // DB makes that flaky). Regression guard for the boolean-query coercion
      // bug: ?isActive=false must NOT return active rows.
      const inactive = await request(app.getHttpServer())
        .get("/api/v1/admin/content/categories?isActive=false&pageSize=100")
        .set(auth(adminToken))
        .expect(200);
      expect(
        inactive.body.data.items.every((c: { isActive: boolean }) => c.isActive === false),
      ).toBe(true);

      const active = await request(app.getHttpServer())
        .get("/api/v1/admin/content/categories?isActive=true&pageSize=100")
        .set(auth(adminToken))
        .expect(200);
      expect(active.body.data.items.every((c: { isActive: boolean }) => c.isActive === true)).toBe(
        true,
      );
    });
  });

  describe("Course lifecycle and status transitions", () => {
    let categoryId: string;
    let courseId: string;

    beforeAll(async () => {
      const cat = await request(app.getHttpServer())
        .post("/api/v1/admin/content/categories")
        .set(auth(adminToken))
        .send({ name: `Courses Cat ${suffix}` })
        .expect(201);
      categoryId = cat.body.data.id;
      createdCategoryIds.push(categoryId);
    });

    it("creates a course in DRAFT", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/admin/content/courses")
        .set(auth(adminToken))
        .send({ categoryId, title: `NID UG ${suffix}`, examType: "NID" })
        .expect(201);
      courseId = res.body.data.id;
      expect(res.body.data.status).toBe("DRAFT");
      expect(res.body.data.publishedAt).toBeNull();
    });

    it("rejects a well-formed but non-existent category on create (400)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/admin/content/courses")
        .set(auth(adminToken))
        // Valid v4 UUID (variant nibble 8) that does not exist -> passes DTO
        // validation, rejected by the service with 400.
        .send({ categoryId: "44444444-4444-4444-8444-444444444444", title: "Bad" })
        .expect(400);
    });

    it("denies status change without content:publish (admin has it — student does not)", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/content/courses/${courseId}/status`)
        .set(auth(studentToken))
        .send({ status: "PUBLISHED" })
        .expect(403);
    });

    it("publishes the course and stamps publishedAt", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/content/courses/${courseId}/status`)
        .set(auth(adminToken))
        .send({ status: "PUBLISHED" })
        .expect(200);
      expect(res.body.data.status).toBe("PUBLISHED");
      expect(res.body.data.publishedAt).not.toBeNull();
    });

    it("refuses to delete a PUBLISHED course", async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/admin/content/courses/${courseId}`)
        .set(auth(adminToken))
        .expect(400);
    });

    it("rejects ARCHIVED -> PUBLISHED", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/content/courses/${courseId}/status`)
        .set(auth(adminToken))
        .send({ status: "ARCHIVED" })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/content/courses/${courseId}/status`)
        .set(auth(adminToken))
        .send({ status: "PUBLISHED" })
        .expect(400);
    });

    it("writes an audit record for the status change", async () => {
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: courseId, action: "content.course_status_changed" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();
    });
  });

  describe("Full hierarchy: subject > topic > module > lesson", () => {
    let courseId: string;

    beforeAll(async () => {
      const cat = await request(app.getHttpServer())
        .post("/api/v1/admin/content/categories")
        .set(auth(adminToken))
        .send({ name: `Hierarchy Cat ${suffix}` })
        .expect(201);
      createdCategoryIds.push(cat.body.data.id);
      const course = await request(app.getHttpServer())
        .post("/api/v1/admin/content/courses")
        .set(auth(adminToken))
        .send({ categoryId: cat.body.data.id, title: `Hierarchy Course ${suffix}` })
        .expect(201);
      courseId = course.body.data.id;
    });

    it("builds the full nested tree and enforces parent existence", async () => {
      const subject = await request(app.getHttpServer())
        .post("/api/v1/admin/content/subjects")
        .set(auth(adminToken))
        .send({ courseId, title: "Visual Spatial Ability" })
        .expect(201);
      const subjectId = subject.body.data.id;
      expect(subject.body.data.courseId).toBe(courseId);

      const topic = await request(app.getHttpServer())
        .post("/api/v1/admin/content/topics")
        .set(auth(adminToken))
        .send({ subjectId, title: "Paper Folding" })
        .expect(201);
      const topicId = topic.body.data.id;

      const mod = await request(app.getHttpServer())
        .post("/api/v1/admin/content/modules")
        .set(auth(adminToken))
        .send({ topicId, title: "Basics", type: "LEARNING" })
        .expect(201);
      const moduleId = mod.body.data.id;
      expect(mod.body.data.type).toBe("LEARNING");

      const lesson = await request(app.getHttpServer())
        .post("/api/v1/admin/content/lessons")
        .set(auth(adminToken))
        .send({
          moduleId,
          title: "Intro to Folding",
          contentType: "VIDEO",
          contentUrl: "https://example.com/video.mp4",
          durationMinutes: 12,
        })
        .expect(201);
      expect(lesson.body.data.contentType).toBe("VIDEO");
      expect(lesson.body.data.status).toBe("DRAFT");

      // A child pointed at a non-existent parent is rejected.
      await request(app.getHttpServer())
        .post("/api/v1/admin/content/topics")
        .set(auth(adminToken))
        .send({ subjectId: "55555555-5555-4555-8555-555555555555", title: "Orphan" })
        .expect(400);

      // Lists are scoped to the parent.
      const topicList = await request(app.getHttpServer())
        .get(`/api/v1/admin/content/topics?subjectId=${subjectId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(topicList.body.data.items).toHaveLength(1);
      expect(topicList.body.data.items[0].id).toBe(topicId);
    });

    it("rejects a duplicate slug within the same parent (409)", async () => {
      const subject = await request(app.getHttpServer())
        .post("/api/v1/admin/content/subjects")
        .set(auth(adminToken))
        .send({ courseId, title: "Duplicate Me", slug: `dup-${suffix}` })
        .expect(201);
      expect(subject.body.data.slug).toBe(`dup-${suffix}`);

      await request(app.getHttpServer())
        .post("/api/v1/admin/content/subjects")
        .set(auth(adminToken))
        .send({ courseId, title: "Duplicate Me Again", slug: `dup-${suffix}` })
        .expect(409);
    });

    it("reorders modules via the reorder endpoint", async () => {
      const subject = await request(app.getHttpServer())
        .post("/api/v1/admin/content/subjects")
        .set(auth(adminToken))
        .send({ courseId, title: "Reorder Subject" })
        .expect(201);
      const topic = await request(app.getHttpServer())
        .post("/api/v1/admin/content/topics")
        .set(auth(adminToken))
        .send({ subjectId: subject.body.data.id, title: "Reorder Topic" })
        .expect(201);
      const topicId = topic.body.data.id;

      const first = await request(app.getHttpServer())
        .post("/api/v1/admin/content/modules")
        .set(auth(adminToken))
        .send({ topicId, title: "Module One" })
        .expect(201);
      const second = await request(app.getHttpServer())
        .post("/api/v1/admin/content/modules")
        .set(auth(adminToken))
        .send({ topicId, title: "Module Two" })
        .expect(201);
      expect(second.body.data.position).toBe(first.body.data.position + 1);

      // Reorder so Module Two comes first.
      await request(app.getHttpServer())
        .post("/api/v1/admin/content/modules/reorder")
        .set(auth(adminToken))
        .send({ orderedIds: [second.body.data.id, first.body.data.id] })
        .expect(204);

      const list = await request(app.getHttpServer())
        .get(`/api/v1/admin/content/modules?topicId=${topicId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(list.body.data.items[0].id).toBe(second.body.data.id);
      expect(list.body.data.items[1].id).toBe(first.body.data.id);
    });
  });

  describe("Validation", () => {
    it("returns 422 for a missing required field", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/admin/content/courses")
        .set(auth(adminToken))
        .send({ examType: "NID" }) // no title
        .expect(422);
    });

    it("returns 422 for a malformed slug", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/admin/content/categories")
        .set(auth(adminToken))
        .send({ name: "X", slug: "Not A Slug" })
        .expect(422);
    });
  });
});
