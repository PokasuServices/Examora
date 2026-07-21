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
import {
  EICAR_TEST_STRING,
  FakeMalwareScannerService,
} from "./support/fake-malware-scanner.service";
import { FakeStorageService } from "./support/fake-storage.service";
import { ensureRolesAndPermissions } from "./support/seed-helpers";

/**
 * Sprint 5 Creative Assignment Engine e2e: assignment/template authoring
 * (RBAC, publish gating), the published catalog, the full student
 * submission lifecycle (draft/upload/scan/submit), reviewer assignment and
 * rubric review (marks/comments/decision), and the quarantine-by-default
 * malware-scan guarantee — against a real Postgres + Redis + BullMQ queue
 * (storage/scanner ports faked, per ADR-0015).
 */
describe("Creative Assignment Engine (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeStorage: FakeStorageService;
  let adminToken: string;
  let studentToken: string;
  let studentId: string;
  let reviewerToken: string;
  let reviewerId: string;
  const suffix = `${Date.now()}`;
  const createdAssignmentIds: string[] = [];
  const createdTemplateIds: string[] = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function waitForScanStatus(
    submissionId: string,
    fileId: string,
    token: string,
    notStatus: string,
    timeoutMs = 15_000,
  ): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/assignment-submissions/${submissionId}`)
        .set(auth(token))
        .expect(200);
      const file = res.body.data.files.find((f: { id: string }) => f.id === fileId);
      if (file && file.scanStatus !== notStatus) {
        return file.scanStatus;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error(`Timed out waiting for file ${fileId} to leave status ${notStatus}`);
  }

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
    fakeStorage = app.get(STORAGE_PORT);
    await ensureRolesAndPermissions(prisma);

    adminToken = (
      await registerUserWithRoles(app, prisma, `s5-admin-${suffix}@example.test`, ["ADMINISTRATOR"])
    ).accessToken;
    const student = await registerUserWithRoles(app, prisma, `s5-student-${suffix}@example.test`, [
      "STUDENT",
    ]);
    studentToken = student.accessToken;
    studentId = student.userId;
    const reviewer = await registerUserWithRoles(app, prisma, `s5-mentor-${suffix}@example.test`, [
      "MENTOR",
    ]);
    reviewerToken = reviewer.accessToken;
    reviewerId = reviewer.userId;
  });

  afterAll(async () => {
    await prisma.assignment.deleteMany({ where: { id: { in: createdAssignmentIds } } });
    await prisma.assignmentTemplate.deleteMany({ where: { id: { in: createdTemplateIds } } });
    await prisma.user.deleteMany({ where: { email: { contains: "s5-" } } });
    await app.close();
  });

  describe("RBAC", () => {
    it("denies a student creating an assignment", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/admin/assignments")
        .set(auth(studentToken))
        .send({
          title: "Nope",
          brief: "b",
          marksTotal: 10,
          fileRules: { allowedMimeTypes: ["image/png"], maxFileSizeMb: 5, maxFiles: 1 },
        })
        .expect(403);
    });

    it("denies an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/api/v1/admin/assignments").expect(401);
    });
  });

  let templateId: string;
  let assignmentId: string;

  describe("Authoring (admin)", () => {
    it("creates a template", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/admin/assignments/templates")
        .set(auth(adminToken))
        .send({
          title: `Poster Template ${suffix}`,
          brief: "Design a poster about sustainability",
          fileRules: {
            allowedMimeTypes: ["image/png", "image/jpeg"],
            maxFileSizeMb: 5,
            maxFiles: 2,
          },
          marksTotal: 20,
          rubric: [
            { title: "Creativity", maxMarks: 10 },
            { title: "Technical execution", maxMarks: 10 },
          ],
        })
        .expect(201);
      templateId = res.body.data.id;
      createdTemplateIds.push(templateId);
    });

    it("creates an assignment from the template and publishes it (criteria already copied)", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/admin/assignments")
        .set(auth(adminToken))
        .send({ title: `Poster Assignment ${suffix}`, templateId })
        .expect(201);
      assignmentId = created.body.data.id;
      createdAssignmentIds.push(assignmentId);
      expect(created.body.data.criteria).toHaveLength(2);

      const published = await request(app.getHttpServer())
        .patch(`/api/v1/admin/assignments/${assignmentId}/status`)
        .set(auth(adminToken))
        .send({ status: "PUBLISHED" })
        .expect(200);
      expect(published.body.data.status).toBe("PUBLISHED");
    });

    it("refuses to publish a freshly-created assignment with no rubric criteria", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/admin/assignments")
        .set(auth(adminToken))
        .send({
          title: `No Rubric ${suffix}`,
          brief: "b",
          marksTotal: 10,
          fileRules: { allowedMimeTypes: ["image/png"], maxFileSizeMb: 5, maxFiles: 1 },
        })
        .expect(201);
      createdAssignmentIds.push(created.body.data.id);
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/assignments/${created.body.data.id}/status`)
        .set(auth(adminToken))
        .send({ status: "PUBLISHED" })
        .expect(400);
    });
  });

  describe("Student catalog", () => {
    it("lists the published assignment", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/assignment-catalog/assignments?pageSize=100")
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.items.some((a: { id: string }) => a.id === assignmentId)).toBe(true);
    });
  });

  let submissionId: string;
  let cleanFileId: string;

  describe("Submission lifecycle (student)", () => {
    it("starts a draft submission", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/assignment-submissions")
        .set(auth(studentToken))
        .send({ assignmentId })
        .expect(201);
      submissionId = res.body.data.id;
      expect(res.body.data.status).toBe("DRAFT");
      expect(res.body.data.version).toBe(1);
    });

    it("uploads a clean file — presign, simulate the browser PUT, confirm, and wait for CLEAN", async () => {
      const presign = await request(app.getHttpServer())
        .post(`/api/v1/assignment-submissions/${submissionId}/files/presign`)
        .set(auth(studentToken))
        .send({ fileName: "poster.png", mimeType: "image/png", sizeBytes: 1000 })
        .expect(201);
      const { key } = presign.body.data;

      fakeStorage.put(key, Buffer.from("a perfectly normal poster image"));

      const confirm = await request(app.getHttpServer())
        .post(`/api/v1/assignment-submissions/${submissionId}/files/confirm`)
        .set(auth(studentToken))
        .send({ key, fileName: "poster.png", mimeType: "image/png", sizeBytes: 1000 })
        .expect(201);
      cleanFileId = confirm.body.data.id;
      expect(confirm.body.data.scanStatus).toBe("PENDING");

      const status = await waitForScanStatus(submissionId, cleanFileId, studentToken, "PENDING");
      expect(status).toBe("CLEAN");
    }, 20_000);

    it("rejects a disallowed file type at presign time", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/assignment-submissions/${submissionId}/files/presign`)
        .set(auth(studentToken))
        .send({ fileName: "notes.txt", mimeType: "text/plain", sizeBytes: 100 })
        .expect(400);
    });

    it("an infected file is quarantined — never downloadable", async () => {
      const presign = await request(app.getHttpServer())
        .post(`/api/v1/assignment-submissions/${submissionId}/files/presign`)
        .set(auth(studentToken))
        .send({ fileName: "eicar.png", mimeType: "image/png", sizeBytes: EICAR_TEST_STRING.length })
        .expect(201);
      const { key } = presign.body.data;
      fakeStorage.put(key, Buffer.from(EICAR_TEST_STRING));

      const confirm = await request(app.getHttpServer())
        .post(`/api/v1/assignment-submissions/${submissionId}/files/confirm`)
        .set(auth(studentToken))
        .send({
          key,
          fileName: "eicar.png",
          mimeType: "image/png",
          sizeBytes: EICAR_TEST_STRING.length,
        })
        .expect(201);
      const infectedFileId = confirm.body.data.id;

      const status = await waitForScanStatus(submissionId, infectedFileId, studentToken, "PENDING");
      expect(status).toBe("INFECTED");

      await request(app.getHttpServer())
        .get(`/api/v1/assignment-submissions/${submissionId}/files/${infectedFileId}/download-url`)
        .set(auth(studentToken))
        .expect(404);

      // Clean up the infected row so it doesn't count against maxFiles for later tests.
      await request(app.getHttpServer())
        .delete(`/api/v1/assignment-submissions/${submissionId}/files/${infectedFileId}`)
        .set(auth(studentToken))
        .expect(204);
    }, 20_000);

    it("a clean file's download url resolves", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/assignment-submissions/${submissionId}/files/${cleanFileId}/download-url`)
        .set(auth(studentToken))
        .expect(200);
    });

    it("submits the final submission", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/assignment-submissions/${submissionId}/submit`)
        .set(auth(studentToken))
        .expect(201);
      expect(res.body.data.status).toBe("SUBMITTED");
    });

    it("rejects further file edits once submitted", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/assignment-submissions/${submissionId}/files/presign`)
        .set(auth(studentToken))
        .send({ fileName: "late.png", mimeType: "image/png", sizeBytes: 100 })
        .expect(409);
    });
  });

  describe("Reviewer assignment + review workflow", () => {
    it("admin assigns the reviewer", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/assignments/submissions/${submissionId}/reviewer`)
        .set(auth(adminToken))
        .send({ reviewerId })
        .expect(200);
      expect(res.body.data.reviewerId).toBe(reviewerId);
    });

    it("the submission appears in the reviewer's queue", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/reviewer/queue?pageSize=100")
        .set(auth(reviewerToken))
        .expect(200);
      expect(res.body.data.items.some((i: { id: string }) => i.id === submissionId)).toBe(true);
    });

    let criterionIds: string[];

    it("reviewer saves a draft review (submission moves to UNDER_REVIEW)", async () => {
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/reviewer/submissions/${submissionId}`)
        .set(auth(reviewerToken))
        .expect(200);
      criterionIds = detail.body.data.criteria.map((c: { id: string }) => c.id);
      expect(detail.body.data.files.some((f: { id: string }) => f.id === cleanFileId)).toBe(true);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/reviewer/submissions/${submissionId}/review`)
        .set(auth(reviewerToken))
        .send({
          overallComment: "Strong concept",
          scores: [
            { criterionId: criterionIds[0], marksAwarded: 8, comment: "great idea" },
            { criterionId: criterionIds[1], marksAwarded: 7 },
          ],
        })
        .expect(201);
      expect(res.body.data.status).toBe("UNDER_REVIEW");
      expect(res.body.data.review.status).toBe("DRAFT");
    });

    it("a non-assigned reviewer cannot access the submission", async () => {
      const otherReviewer = await registerUserWithRoles(
        app,
        prisma,
        `s5-otherreviewer-${suffix}@example.test`,
        ["REVIEWER"],
      );
      await request(app.getHttpServer())
        .get(`/api/v1/reviewer/submissions/${submissionId}`)
        .set(auth(otherReviewer.accessToken))
        .expect(404);
    });

    it("publishes the review with an APPROVED decision", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/reviewer/submissions/${submissionId}/review/publish`)
        .set(auth(reviewerToken))
        .send({ decision: "APPROVED" })
        .expect(201);
      expect(res.body.data.status).toBe("APPROVED");
      expect(res.body.data.review.status).toBe("PUBLISHED");
      expect(res.body.data.review.obtainedMarks).toBe(15);
    });

    it("the student now sees the published review in their submission detail", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/assignment-submissions/${submissionId}`)
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.status).toBe("APPROVED");
      expect(res.body.data.review.decision).toBe("APPROVED");
      expect(res.body.data.review.obtainedMarks).toBe(15);
    });

    it("appears in the student's submission history", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/assignment-submissions?assignmentId=${assignmentId}`)
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.items.some((h: { id: string }) => h.id === submissionId)).toBe(true);
    });

    it("records an audit entry for the published review", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/audit-logs?entityType=AssignmentReview&pageSize=100`)
        .set(auth(adminToken))
        .expect(200);
      expect(
        res.body.data.items.some(
          (e: { action: string }) => e.action === "assignments.review_published",
        ),
      ).toBe(true);
    });
  });

  describe("Admin monitoring", () => {
    it("lists the submission with student/reviewer emails", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/assignments/submissions?assignmentId=${assignmentId}`)
        .set(auth(adminToken))
        .expect(200);
      const row = res.body.data.items.find((s: { id: string }) => s.id === submissionId);
      expect(row.studentId).toBe(studentId);
      expect(row.reviewerId).toBe(reviewerId);
    });
  });
});
