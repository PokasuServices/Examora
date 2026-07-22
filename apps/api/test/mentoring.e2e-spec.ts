import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { MALWARE_SCANNER_PORT } from "../src/malware-scan/malware-scanner.port";
import { PrismaService } from "../src/prisma/prisma.service";
import { configureApp } from "../src/setup-app";
import { STORAGE_PORT } from "../src/storage/storage.port";
import { registerUserWithRoles } from "./support/auth-helpers";
import { FakeMalwareScannerService } from "./support/fake-malware-scanner.service";
import { FakeStorageService } from "./support/fake-storage.service";
import { ensureRolesAndPermissions } from "./support/seed-helpers";

/**
 * Sprint 6 Mentor Management e2e (ADR-0016): RBAC (including the MENTOR vs
 * REVIEWER permission divergence), admin mentor profile CRUD + workload,
 * mentor↔student assignment history, the mentor's own dashboard, Student 360
 * (ownership-checked), and the mentor workflow (notes/tasks/feedback/
 * meetings) — against a real Postgres, reusing Sprint 3/4/5's
 * Learning/Assessment/Assignment services via MentoringModule.
 */
describe("Mentor Management (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let mentorToken: string;
  let mentorId: string;
  let strangerMentorToken: string;
  let strangerMentorId: string;
  let reviewerToken: string;
  let studentToken: string;
  let studentId: string;
  const suffix = `${Date.now()}`;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(STORAGE_PORT)
      .useClass(FakeStorageService)
      .overrideProvider(MALWARE_SCANNER_PORT)
      .useClass(FakeMalwareScannerService)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await ensureRolesAndPermissions(prisma);

    adminToken = (
      await registerUserWithRoles(app, prisma, `s6-admin-${suffix}@example.test`, ["ADMINISTRATOR"])
    ).accessToken;
    const mentor = await registerUserWithRoles(app, prisma, `s6-mentor-${suffix}@example.test`, [
      "MENTOR",
    ]);
    mentorToken = mentor.accessToken;
    mentorId = mentor.userId;
    const strangerMentor = await registerUserWithRoles(
      app,
      prisma,
      `s6-stranger-${suffix}@example.test`,
      ["MENTOR"],
    );
    strangerMentorToken = strangerMentor.accessToken;
    strangerMentorId = strangerMentor.userId;
    reviewerToken = (
      await registerUserWithRoles(app, prisma, `s6-reviewer-${suffix}@example.test`, ["REVIEWER"])
    ).accessToken;
    const student = await registerUserWithRoles(app, prisma, `s6-student-${suffix}@example.test`, [
      "STUDENT",
    ]);
    studentToken = student.accessToken;
    studentId = student.userId;
  });

  afterAll(async () => {
    await prisma.mentorAssignment.deleteMany({ where: { studentId } });
    await prisma.mentorProfile.deleteMany({
      where: { userId: { in: [mentorId, strangerMentorId] } },
    });
    await prisma.user.deleteMany({ where: { email: { contains: "s6-" } } });
    await app.close();
  });

  describe("RBAC", () => {
    it("denies a student creating a mentor profile", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/admin/mentors")
        .set(auth(studentToken))
        .send({ userId: mentorId })
        .expect(403);
    });

    it("denies an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/api/v1/admin/mentors").expect(401);
    });

    it("a plain REVIEWER (not MENTOR) is denied mentor:workflow routes", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/mentor/dashboard`)
        .set(auth(reviewerToken))
        .expect(403);
    });
  });

  describe("Admin: mentor profile + workload", () => {
    it("creates a mentor profile", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/admin/mentors")
        .set(auth(adminToken))
        .send({ userId: mentorId, bio: "Design mentor", maxStudents: 5 })
        .expect(201);
      expect(res.body.data.userId).toBe(mentorId);
      expect(res.body.data.maxStudents).toBe(5);
    });

    it("rejects creating a profile for a non-MENTOR user", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/admin/mentors")
        .set(auth(adminToken))
        .send({ userId: studentId })
        .expect(400);
    });

    it("lists mentor profiles with workload", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/mentors?pageSize=100")
        .set(auth(adminToken))
        .expect(200);
      const row = res.body.data.items.find((m: { userId: string }) => m.userId === mentorId);
      expect(row).toBeDefined();
      expect(row.activeStudentCount).toBe(0);
    });

    it("the admin mentor dashboard summarizes total workload", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/mentors/dashboard")
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.totalMentors).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Admin: mentor assignment", () => {
    it("assigns a mentor to a student", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/mentor-assignments/${studentId}`)
        .set(auth(adminToken))
        .send({ mentorId })
        .expect(201);
      expect(res.body.data.mentorId).toBe(mentorId);
      expect(res.body.data.unassignedAt).toBeNull();
    });

    it("reassigning supersedes the previous assignment (history preserved)", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentor-assignments/${studentId}`)
        .set(auth(adminToken))
        .send({ mentorId: strangerMentorId })
        .expect(201);

      const history = await request(app.getHttpServer())
        .get(`/api/v1/admin/mentor-assignments?studentId=${studentId}&pageSize=100`)
        .set(auth(adminToken))
        .expect(200);
      expect(history.body.data.items.length).toBeGreaterThanOrEqual(2);

      // Reassign back to `mentor` for the rest of the suite.
      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentor-assignments/${studentId}`)
        .set(auth(adminToken))
        .send({ mentorId })
        .expect(201);
    });
  });

  describe("Mentor: own dashboard", () => {
    it("lists the mentor's assigned students", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/mentor/students")
        .set(auth(mentorToken))
        .expect(200);
      expect(res.body.data.some((s: { studentId: string }) => s.studentId === studentId)).toBe(
        true,
      );
    });

    it("returns the mentor's own dashboard with profile and caseload", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/mentor/dashboard")
        .set(auth(mentorToken))
        .expect(200);
      expect(res.body.data.profile.userId).toBe(mentorId);
      expect(
        res.body.data.assignedStudents.some(
          (s: { studentId: string }) => s.studentId === studentId,
        ),
      ).toBe(true);
    });
  });

  describe("Student 360", () => {
    it("the assigned mentor can view the student's 360", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/360`)
        .set(auth(mentorToken))
        .expect(200);
      expect(res.body.data.profile.id).toBe(studentId);
      expect(res.body.data.currentMentor.id).toBe(mentorId);
      expect(res.body.data.learningProgress).toBeDefined();
      expect(Array.isArray(res.body.data.activityTimeline)).toBe(true);
    });

    it("a non-assigned mentor is denied", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/360`)
        .set(auth(strangerMentorToken))
        .expect(403);
    });

    it("an admin can view any student's 360", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/360`)
        .set(auth(adminToken))
        .expect(200);
    });
  });

  describe("Mentor workflow", () => {
    let noteId: string;
    let taskId: string;

    it("creates, updates and deletes a note", async () => {
      const created = await request(app.getHttpServer())
        .post(`/api/v1/students/${studentId}/notes`)
        .set(auth(mentorToken))
        .send({ body: "Needs help with perspective drawing" })
        .expect(201);
      noteId = created.body.data.id;

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/students/${studentId}/notes/${noteId}`)
        .set(auth(mentorToken))
        .send({ body: "Improving with perspective drawing" })
        .expect(200);
      expect(updated.body.data.body).toBe("Improving with perspective drawing");

      await request(app.getHttpServer())
        .delete(`/api/v1/students/${studentId}/notes/${noteId}`)
        .set(auth(mentorToken))
        .expect(204);
    });

    it("a non-assigned mentor cannot add a note", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/students/${studentId}/notes`)
        .set(auth(strangerMentorToken))
        .send({ body: "nope" })
        .expect(403);
    });

    it("assigns a task and marks it completed", async () => {
      const created = await request(app.getHttpServer())
        .post(`/api/v1/students/${studentId}/tasks`)
        .set(auth(mentorToken))
        .send({ title: "Submit revised sketch" })
        .expect(201);
      taskId = created.body.data.id;
      expect(created.body.data.status).toBe("PENDING");

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/students/${studentId}/tasks/${taskId}`)
        .set(auth(mentorToken))
        .send({ status: "COMPLETED" })
        .expect(200);
      expect(updated.body.data.status).toBe("COMPLETED");
      expect(updated.body.data.completedAt).not.toBeNull();
    });

    it("shares feedback", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/students/${studentId}/feedback`)
        .set(auth(mentorToken))
        .send({ body: "Great progress this month" })
        .expect(201);
      expect(res.body.data.mentorId).toBe(mentorId);
    });

    it("logs a meeting", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/students/${studentId}/meetings`)
        .set(auth(mentorToken))
        .send({
          occurredAt: new Date().toISOString(),
          durationMinutes: 20,
          summary: "Weekly check-in",
        })
        .expect(201);
      expect(res.body.data.durationMinutes).toBe(20);
    });

    it("records audit entries for mentor workflow actions", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/audit-logs?entityType=MentorTask&pageSize=100")
        .set(auth(adminToken))
        .expect(200);
      expect(
        res.body.data.items.some((e: { action: string }) => e.action === "mentoring.task_created"),
      ).toBe(true);
    });
  });

  describe("Admin: unassign", () => {
    it("unassigns a student's mentor", async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/admin/mentor-assignments/${studentId}`)
        .set(auth(adminToken))
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/360`)
        .set(auth(mentorToken))
        .expect(403);
    });
  });
});
