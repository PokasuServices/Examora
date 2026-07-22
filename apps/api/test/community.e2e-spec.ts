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
 * Sprint 7 Community & Discussion Module e2e (ADR-0017): RBAC, forum
 * category/board admin CRUD, thread/reply CRUD and nesting, Doubt
 * Resolution (accept-answer), likes/bookmarks/follows, reputation, the
 * activity timeline, moderation (report queue, hide/restore/lock/unlock/
 * pin/unpin), search, and the attachment upload/scan pipeline — against a
 * real Postgres + Redis + BullMQ queue (storage/scanner ports faked).
 */
describe("Community & Discussion Module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeStorage: FakeStorageService;
  let adminToken: string;
  let studentToken: string;
  let studentId: string;
  let otherToken: string;
  let boardId: string;
  let discussionThreadId: string;
  let questionThreadId: string;
  let topReplyId: string;
  const suffix = `${Date.now()}`;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function waitForAttachmentStatus(
    targetType: "THREAD" | "REPLY",
    targetId: string,
    attachmentId: string,
    token: string,
    notStatus: string,
    timeoutMs = 15_000,
  ): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/community/attachments?targetType=${targetType}&targetId=${targetId}`)
        .set(auth(token))
        .expect(200);
      const attachment = res.body.data.find((a: { id: string }) => a.id === attachmentId);
      if (attachment && attachment.scanStatus !== notStatus) {
        return attachment.scanStatus;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error(
      `Timed out waiting for attachment ${attachmentId} to leave status ${notStatus}`,
    );
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
      await registerUserWithRoles(app, prisma, `s7-admin-${suffix}@example.test`, ["ADMINISTRATOR"])
    ).accessToken;
    const student = await registerUserWithRoles(app, prisma, `s7-student-${suffix}@example.test`, [
      "STUDENT",
    ]);
    studentToken = student.accessToken;
    studentId = student.userId;
    const other = await registerUserWithRoles(app, prisma, `s7-other-${suffix}@example.test`, [
      "STUDENT",
    ]);
    otherToken = other.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: "s7-" } } });
    await app.close();
  });

  describe("RBAC", () => {
    it("denies an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/api/v1/community/categories").expect(401);
    });

    it("denies a student creating a forum category", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/admin/community/categories")
        .set(auth(studentToken))
        .send({ title: "Should fail" })
        .expect(403);
    });
  });

  describe("Admin: forums", () => {
    it("creates a category and a board under it", async () => {
      const category = await request(app.getHttpServer())
        .post("/api/v1/admin/community/categories")
        .set(auth(adminToken))
        .send({ title: `Design Talk ${suffix}` })
        .expect(201);

      const board = await request(app.getHttpServer())
        .post("/api/v1/admin/community/boards")
        .set(auth(adminToken))
        .send({ categoryId: category.body.data.id, title: `Fashion Design ${suffix}` })
        .expect(201);
      boardId = board.body.data.id;
      expect(board.body.data.categoryId).toBe(category.body.data.id);
    });

    it("students can browse the active catalog", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/community/boards?pageSize=100`)
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.items.some((b: { id: string }) => b.id === boardId)).toBe(true);
    });
  });

  describe("Threads", () => {
    it("a student creates a discussion thread", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/community/threads")
        .set(auth(studentToken))
        .send({
          boardId,
          title: `Pixel shading tips ${suffix}`,
          body: "How do you shade pixel art?",
        })
        .expect(201);
      discussionThreadId = res.body.data.id;
      expect(res.body.data.type).toBe("DISCUSSION");
      expect(res.body.data.status).toBe("OPEN");
    });

    it("a student creates a question", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/community/threads")
        .set(auth(studentToken))
        .send({ boardId, type: "QUESTION", title: `Why is my layer flat? ${suffix}`, body: "Help" })
        .expect(201);
      questionThreadId = res.body.data.id;
      expect(res.body.data.type).toBe("QUESTION");
      expect(res.body.data.isSolved).toBe(false);
    });

    it("lists threads on the board", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/community/threads?boardId=${boardId}&pageSize=100`)
        .set(auth(studentToken))
        .expect(200);
      const ids = res.body.data.items.map((t: { id: string }) => t.id);
      expect(ids).toEqual(expect.arrayContaining([discussionThreadId, questionThreadId]));
    });

    it("viewing a thread increments its view count", async () => {
      const first = await request(app.getHttpServer())
        .get(`/api/v1/community/threads/${discussionThreadId}`)
        .set(auth(otherToken))
        .expect(200);
      const second = await request(app.getHttpServer())
        .get(`/api/v1/community/threads/${discussionThreadId}`)
        .set(auth(otherToken))
        .expect(200);
      expect(second.body.data.viewCount).toBeGreaterThan(first.body.data.viewCount);
    });

    it("rejects an edit from a non-owner and allows the owner", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/community/threads/${discussionThreadId}`)
        .set(auth(otherToken))
        .send({ title: "Hijacked" })
        .expect(403);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/community/threads/${discussionThreadId}`)
        .set(auth(studentToken))
        .send({ title: "Edited title" })
        .expect(200);
      expect(res.body.data.title).toBe("Edited title");
    });

    it("closes and reopens a thread", async () => {
      const closed = await request(app.getHttpServer())
        .post(`/api/v1/community/threads/${discussionThreadId}/close`)
        .set(auth(studentToken))
        .expect(201);
      expect(closed.body.data.status).toBe("CLOSED");

      const reopened = await request(app.getHttpServer())
        .post(`/api/v1/community/threads/${discussionThreadId}/reopen`)
        .set(auth(studentToken))
        .expect(201);
      expect(reopened.body.data.status).toBe("OPEN");
    });
  });

  describe("Replies & Doubt Resolution", () => {
    it("posts a top-level reply and a nested reply", async () => {
      const top = await request(app.getHttpServer())
        .post(`/api/v1/community/threads/${questionThreadId}/replies`)
        .set(auth(otherToken))
        .send({ body: "Check your blend mode" })
        .expect(201);
      topReplyId = top.body.data.id;

      await request(app.getHttpServer())
        .post(`/api/v1/community/threads/${questionThreadId}/replies`)
        .set(auth(studentToken))
        .send({ body: "Thanks, that worked!", parentReplyId: topReplyId })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get(`/api/v1/community/threads/${questionThreadId}/replies`)
        .set(auth(studentToken))
        .expect(200);
      const topNode = list.body.data.items.find((r: { id: string }) => r.id === topReplyId);
      expect(topNode.children).toHaveLength(1);
    });

    it("the question author accepts the top reply as the answer", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/community/threads/${questionThreadId}/accept-answer`)
        .set(auth(studentToken))
        .send({ replyId: topReplyId })
        .expect(201);
      expect(res.body.data.isSolved).toBe(true);
    });

    it("a non-author, non-moderator cannot reply to a locked thread", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/community/moderation/threads/${questionThreadId}/lock`)
        .set(auth(adminToken))
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/community/threads/${questionThreadId}/replies`)
        .set(auth(otherToken))
        .send({ body: "blocked" })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/api/v1/community/moderation/threads/${questionThreadId}/unlock`)
        .set(auth(adminToken))
        .expect(201);
    });
  });

  describe("Reactions", () => {
    it("toggles a like on a thread", async () => {
      const liked = await request(app.getHttpServer())
        .post(`/api/v1/community/threads/${discussionThreadId}/like`)
        .set(auth(otherToken))
        .expect(201);
      expect(liked.body.data).toEqual({ liked: true, likeCount: 1 });

      const unliked = await request(app.getHttpServer())
        .post(`/api/v1/community/threads/${discussionThreadId}/like`)
        .set(auth(otherToken))
        .expect(201);
      expect(unliked.body.data).toEqual({ liked: false, likeCount: 0 });
    });

    it("toggles a bookmark and it shows up in the caller's bookmark list", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/community/threads/${discussionThreadId}/bookmark`)
        .set(auth(otherToken))
        .expect(201);

      const bookmarks = await request(app.getHttpServer())
        .get("/api/v1/community/bookmarks?pageSize=100")
        .set(auth(otherToken))
        .expect(200);
      expect(
        bookmarks.body.data.items.some((t: { id: string }) => t.id === discussionThreadId),
      ).toBe(true);
    });

    it("toggles a follow on a thread", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/community/threads/${discussionThreadId}/follow`)
        .set(auth(otherToken))
        .expect(201);
      expect(res.body.data.following).toBe(true);
    });
  });

  describe("Reputation", () => {
    it("the question author gained reputation from creating content", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/community/reputation/${studentId}`)
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.reputationPoints).toBeGreaterThan(0);
    });
  });

  describe("Activity timeline", () => {
    it("a user can view their own timeline", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/community/activity/${studentId}`)
        .set(auth(studentToken))
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("another non-moderator user cannot view someone else's timeline", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/community/activity/${studentId}`)
        .set(auth(otherToken))
        .expect(403);
    });
  });

  describe("Moderation", () => {
    it("reports a thread and an admin reviews it", async () => {
      const report = await request(app.getHttpServer())
        .post("/api/v1/community/reports")
        .set(auth(otherToken))
        .send({ targetType: "THREAD", targetId: discussionThreadId, reason: "Spam" })
        .expect(201);
      expect(report.body.data.status).toBe("PENDING");

      const queue = await request(app.getHttpServer())
        .get("/api/v1/community/moderation/reports?status=PENDING&pageSize=100")
        .set(auth(adminToken))
        .expect(200);
      expect(queue.body.data.items.some((r: { id: string }) => r.id === report.body.data.id)).toBe(
        true,
      );

      const reviewed = await request(app.getHttpServer())
        .patch(`/api/v1/community/moderation/reports/${report.body.data.id}`)
        .set(auth(adminToken))
        .send({ status: "REVIEWED" })
        .expect(200);
      expect(reviewed.body.data.status).toBe("REVIEWED");
    });

    it("a student cannot access the moderation queue", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/community/moderation/reports")
        .set(auth(studentToken))
        .expect(403);
    });

    it("hides and restores a thread", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/community/moderation/threads/${discussionThreadId}/hide`)
        .set(auth(adminToken))
        .send({ reason: "Under review" })
        .expect(201);

      const listWhileHidden = await request(app.getHttpServer())
        .get(`/api/v1/community/threads?boardId=${boardId}&pageSize=100`)
        .set(auth(studentToken))
        .expect(200);
      expect(
        listWhileHidden.body.data.items.some((t: { id: string }) => t.id === discussionThreadId),
      ).toBe(false);

      await request(app.getHttpServer())
        .post(`/api/v1/community/moderation/threads/${discussionThreadId}/restore`)
        .set(auth(adminToken))
        .expect(201);

      const listAfterRestore = await request(app.getHttpServer())
        .get(`/api/v1/community/threads?boardId=${boardId}&pageSize=100`)
        .set(auth(studentToken))
        .expect(200);
      expect(
        listAfterRestore.body.data.items.some((t: { id: string }) => t.id === discussionThreadId),
      ).toBe(true);
    });

    it("pins and unpins a thread", async () => {
      const pinned = await request(app.getHttpServer())
        .post(`/api/v1/community/moderation/threads/${discussionThreadId}/pin`)
        .set(auth(adminToken))
        .expect(201);
      expect(pinned.body.data.isPinned).toBe(true);

      const unpinned = await request(app.getHttpServer())
        .post(`/api/v1/community/moderation/threads/${discussionThreadId}/unpin`)
        .set(auth(adminToken))
        .expect(201);
      expect(unpinned.body.data.isPinned).toBe(false);
    });
  });

  describe("Search", () => {
    it("finds the thread by a keyword in its title", async () => {
      // Searches for the question thread's title, not the discussion thread's —
      // the discussion thread's title was overwritten by the earlier
      // "rejects an edit ..." test in the Threads block.
      const res = await request(app.getHttpServer())
        .get(`/api/v1/community/search?q=${encodeURIComponent(`Why is my layer flat? ${suffix}`)}`)
        .set(auth(studentToken))
        .expect(200);
      expect(res.body.data.items.some((t: { id: string }) => t.id === questionThreadId)).toBe(true);
    });
  });

  describe("Attachments", () => {
    it("uploads a clean image attachment on the caller's own thread", async () => {
      const presign = await request(app.getHttpServer())
        .post("/api/v1/community/attachments/presign")
        .set(auth(studentToken))
        .send({
          targetType: "THREAD",
          targetId: discussionThreadId,
          fileName: "sketch.png",
          mimeType: "image/png",
          sizeBytes: 1000,
        })
        .expect(201);
      const { key } = presign.body.data;
      fakeStorage.put(key, Buffer.from("a perfectly normal sketch"));

      const confirm = await request(app.getHttpServer())
        .post("/api/v1/community/attachments/confirm")
        .set(auth(studentToken))
        .send({
          targetType: "THREAD",
          targetId: discussionThreadId,
          storageKey: key,
          fileName: "sketch.png",
          mimeType: "image/png",
          sizeBytes: 1000,
        })
        .expect(201);
      const attachmentId = confirm.body.data.id;
      expect(confirm.body.data.scanStatus).toBe("PENDING");

      const status = await waitForAttachmentStatus(
        "THREAD",
        discussionThreadId,
        attachmentId,
        studentToken,
        "PENDING",
      );
      expect(status).toBe("CLEAN");

      const download = await request(app.getHttpServer())
        .get(`/api/v1/community/attachments/${attachmentId}/download-url`)
        .set(auth(studentToken))
        .expect(200);
      expect(download.body.data.url).toContain(key);

      await request(app.getHttpServer())
        .delete(`/api/v1/community/attachments/${attachmentId}`)
        .set(auth(studentToken))
        .expect(204);
    }, 20_000);

    it("rejects attaching a file to someone else's thread", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/community/attachments/presign")
        .set(auth(otherToken))
        .send({
          targetType: "THREAD",
          targetId: discussionThreadId,
          fileName: "sketch.png",
          mimeType: "image/png",
          sizeBytes: 1000,
        })
        .expect(400);
    });
  });

  describe("Audit logging", () => {
    it("records an audit entry for thread creation", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/audit-logs?entityType=Thread&pageSize=100")
        .set(auth(adminToken))
        .expect(200);
      expect(
        res.body.data.items.some(
          (e: { action: string }) => e.action === "community.thread_created",
        ),
      ).toBe(true);
    });
  });
});
