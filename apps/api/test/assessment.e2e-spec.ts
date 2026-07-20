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
 * Sprint 4 assessment & quiz engine e2e: question bank + quiz authoring
 * (RBAC, validation, publish gating), the published quiz catalog, the full
 * student attempt lifecycle (start/autosave/submit/idempotent/review/
 * history), admin attempt monitoring + result dashboard, and audit logging —
 * against a real Postgres instance.
 */
describe("Assessment & Quiz Engine (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  let studentId: string;
  let otherStudentToken: string;
  const suffix = `${Date.now()}`;
  const createdQuizIds: string[] = [];
  const createdQuestionIds: string[] = [];

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
      await registerUserWithRoles(app, prisma, `s4-admin-${suffix}@example.test`, ["ADMINISTRATOR"])
    ).accessToken;
    const student = await registerUserWithRoles(app, prisma, `s4-student-${suffix}@example.test`, [
      "STUDENT",
    ]);
    studentToken = student.accessToken;
    studentId = student.userId;
    otherStudentToken = (
      await registerUserWithRoles(app, prisma, `s4-student2-${suffix}@example.test`, ["STUDENT"])
    ).accessToken;
  });

  afterAll(async () => {
    await prisma.quiz.deleteMany({ where: { id: { in: createdQuizIds } } });
    await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
    await prisma.user.deleteMany({ where: { email: { contains: `s4-` } } });
    await app.close();
  });

  describe("RBAC", () => {
    it("denies a student creating a question", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/admin/assessment/questions")
        .set(auth(studentToken))
        .send({ type: "SINGLE_CHOICE", text: "Nope", options: [{ text: "A", isCorrect: true }] })
        .expect(403);
    });

    it("denies an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/api/v1/admin/assessment/questions").expect(401);
    });
  });

  let publishedQuestionId: string;
  let optionIds: { correct: string; wrong: string };

  describe("Question bank (admin)", () => {
    it("rejects a structurally-invalid DTO (missing required text) with 422", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/admin/assessment/questions")
        .set(auth(adminToken))
        .send({
          type: "SINGLE_CHOICE",
          options: [
            { text: "A", isCorrect: true },
            { text: "B", isCorrect: false },
          ],
        })
        .expect(422);
    });

    it("rejects a structurally-valid question with zero correct options (business rule) with 400", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/admin/assessment/questions")
        .set(auth(adminToken))
        .send({
          type: "SINGLE_CHOICE",
          text: "No correct option",
          options: [
            { text: "A", isCorrect: false },
            { text: "B", isCorrect: false },
          ],
        })
        .expect(400);
    });

    it("creates a question in DRAFT, then publishes it", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/admin/assessment/questions")
        .set(auth(adminToken))
        .send({
          type: "SINGLE_CHOICE",
          text: `2 + 2 = ? ${suffix}`,
          explanation: "Basic addition.",
          tags: ["arithmetic"],
          options: [
            { text: "4", isCorrect: true },
            { text: "5", isCorrect: false },
          ],
        })
        .expect(201);
      createdQuestionIds.push(created.body.data.id);
      expect(created.body.data.status).toBe("DRAFT");

      const published = await request(app.getHttpServer())
        .patch(`/api/v1/admin/assessment/questions/${created.body.data.id}/status`)
        .set(auth(adminToken))
        .send({ status: "PUBLISHED" })
        .expect(200);
      expect(published.body.data.status).toBe("PUBLISHED");

      publishedQuestionId = created.body.data.id;
      optionIds = {
        correct: created.body.data.options.find((o: { isCorrect: boolean }) => o.isCorrect).id,
        wrong: created.body.data.options.find((o: { isCorrect: boolean }) => !o.isCorrect).id,
      };
    });
  });

  let quizId: string;

  describe("Quiz authoring (admin) — publish gating", () => {
    it("refuses to publish a quiz with no assigned questions", async () => {
      const quiz = await request(app.getHttpServer())
        .post("/api/v1/admin/assessment/quizzes")
        .set(auth(adminToken))
        .send({
          title: `Empty Quiz ${suffix}`,
          negativeMarkingEnabled: true,
          negativeMarksPerWrong: 0.25,
        })
        .expect(201);
      createdQuizIds.push(quiz.body.data.id);

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/assessment/quizzes/${quiz.body.data.id}/status`)
        .set(auth(adminToken))
        .send({ status: "PUBLISHED" })
        .expect(400);
    });

    it("assigns the published question and publishes the quiz", async () => {
      const quiz = await request(app.getHttpServer())
        .post("/api/v1/admin/assessment/quizzes")
        .set(auth(adminToken))
        .send({
          title: `Arithmetic Quiz ${suffix}`,
          timeLimitMinutes: 30,
          passingScorePercent: 50,
          negativeMarkingEnabled: true,
          negativeMarksPerWrong: 0.25,
        })
        .expect(201);
      quizId = quiz.body.data.id;
      createdQuizIds.push(quizId);

      await request(app.getHttpServer())
        .post(`/api/v1/admin/assessment/quizzes/${quizId}/questions`)
        .set(auth(adminToken))
        .send({ questionId: publishedQuestionId, marks: 4 })
        .expect(201);

      const published = await request(app.getHttpServer())
        .patch(`/api/v1/admin/assessment/quizzes/${quizId}/status`)
        .set(auth(adminToken))
        .send({ status: "PUBLISHED" })
        .expect(200);
      expect(published.body.data.status).toBe("PUBLISHED");
    });

    it("admin quiz detail reports totalQuestions and totalMarks", async () => {
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/admin/assessment/quizzes/${quizId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(detail.body.data.totalQuestions).toBe(1);
      expect(detail.body.data.totalMarks).toBe(4);
    });
  });

  describe("Student catalog (published-only)", () => {
    it("lists the published quiz for a student", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/quiz-catalog/quizzes?pageSize=100")
        .set(auth(studentToken))
        .expect(200);
      const ids = res.body.data.items.map((q: { id: string }) => q.id);
      expect(ids).toContain(quizId);
    });

    it("quiz detail exposes metadata but never question content", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/quiz-catalog/quizzes/${quizId}`)
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.totalQuestions).toBe(1);
      expect(res.body.data).not.toHaveProperty("questions");
    });
  });

  let attemptId: string;

  describe("Attempt lifecycle (student)", () => {
    it("starts an attempt exposing options but never isCorrect", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/quiz-attempts")
        .set(auth(studentToken))
        .send({ quizId })
        .expect(201);
      attemptId = res.body.data.id;
      expect(res.body.data.status).toBe("IN_PROGRESS");
      expect(res.body.data.questions).toHaveLength(1);
      expect(res.body.data.questions[0]).not.toHaveProperty("isCorrect");
      expect(res.body.data.questions[0].options.map((o: { id: string }) => o.id).sort()).toEqual(
        [optionIds.correct, optionIds.wrong].sort(),
      );
    });

    it("calling start again resumes the same attempt", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/quiz-attempts")
        .set(auth(studentToken))
        .send({ quizId })
        .expect(201);
      expect(res.body.data.id).toBe(attemptId);
    });

    it("a different student cannot access this attempt", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/quiz-attempts/${attemptId}`)
        .set(auth(otherStudentToken))
        .expect(404);
    });

    it("autosaves the correct answer", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/quiz-attempts/${attemptId}/answers`)
        .set(auth(studentToken))
        .send({ questionId: publishedQuestionId, selectedOptionIds: [optionIds.correct] })
        .expect(204);
    });

    it("rejects an option id not offered for the question", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/quiz-attempts/${attemptId}/answers`)
        .set(auth(studentToken))
        .send({
          questionId: publishedQuestionId,
          selectedOptionIds: ["00000000-0000-4000-8000-000000000099"],
        })
        .expect(400);
    });

    it("submits and scores the attempt, then is idempotent on a second submit", async () => {
      const first = await request(app.getHttpServer())
        .post(`/api/v1/quiz-attempts/${attemptId}/submit`)
        .set(auth(studentToken))
        .expect(201);
      expect(first.body.data.status).toBe("SUBMITTED");
      expect(first.body.data.obtainedMarks).toBe(4);
      expect(first.body.data.percentage).toBe(100);
      expect(first.body.data.passed).toBe(true);

      const second = await request(app.getHttpServer())
        .post(`/api/v1/quiz-attempts/${attemptId}/submit`)
        .set(auth(studentToken))
        .expect(201);
      expect(second.body.data).toEqual(first.body.data);
    });

    it("rejects further autosave once finalized", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/quiz-attempts/${attemptId}/answers`)
        .set(auth(studentToken))
        .send({ questionId: publishedQuestionId, selectedOptionIds: [optionIds.wrong] })
        .expect(409);
    });

    it("review shows the correct answer, the student's answer, and the explanation", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/quiz-attempts/${attemptId}/review`)
        .set(auth(studentToken))
        .expect(200);
      const q = res.body.data.questions[0];
      expect(q.selectedOptionIds).toEqual([optionIds.correct]);
      expect(q.isCorrect).toBe(true);
      expect(q.explanation).toBe("Basic addition.");
      expect(q.options.find((o: { id: string }) => o.id === optionIds.correct).isCorrect).toBe(
        true,
      );
    });

    it("appears in the student's attempt history", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/quiz-attempts?pageSize=50")
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.items.some((a: { id: string }) => a.id === attemptId)).toBe(true);
    });

    it("only records ONE audit entry for the submission despite the duplicate submit call", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/audit-logs?entityType=QuizAttempt&pageSize=100`)
        .set(auth(adminToken))
        .expect(200);
      const submitEvents = res.body.data.items.filter(
        (e: { action: string; entityId: string }) =>
          e.action === "assessment.quiz_attempt_submitted" && e.entityId === attemptId,
      );
      expect(submitEvents).toHaveLength(1);
    });
  });

  describe("Admin attempt monitoring + result dashboard", () => {
    it("lists the attempt with the student's email and score", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/assessment/attempts?quizId=${quizId}`)
        .set(auth(adminToken))
        .expect(200);
      const row = res.body.data.items.find((a: { id: string }) => a.id === attemptId);
      expect(row.userId).toBe(studentId);
      expect(row.percentage).toBe(100);
    });

    it("returns full attempt detail with per-question answers", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/assessment/attempts/${attemptId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.answers).toHaveLength(1);
      expect(res.body.data.answers[0].isCorrect).toBe(true);
    });

    it("denies a student from reading attempt monitoring", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/admin/assessment/attempts`)
        .set(auth(studentToken))
        .expect(403);
    });

    it("aggregates a result dashboard for the quiz", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/assessment/quizzes/${quizId}/results`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.totalAttempts).toBeGreaterThanOrEqual(1);
      expect(res.body.data.completedAttempts).toBeGreaterThanOrEqual(1);
      expect(res.body.data.passCount).toBeGreaterThanOrEqual(1);
    });
  });
});
