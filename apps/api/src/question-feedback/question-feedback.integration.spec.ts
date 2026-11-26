import { BadRequestException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { CmsAssetScanQueueService } from "../cms/assets/cms-asset-scan-queue.service";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_PORT } from "../storage/storage.port";
import { QuestionFeedbackService } from "./question-feedback.service";

/** Discussion posts: doubt vs explanation, image uploads and ownership, reporting. */
describe("QuestionFeedbackService (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let feedback: QuestionFeedbackService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userIds: string[] = [];
  let authorId: string;
  let otherId: string;
  let courseId: string;
  let questionId: string;
  const presign = jest.fn(async ({ key }: { key: string }) => ({
    url: "https://storage.test/upload",
    key,
    expiresAt: new Date().toISOString(),
  }));
  const enqueue = jest.fn();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        QuestionFeedbackService,
        PrismaService,
        { provide: STORAGE_PORT, useValue: { createPresignedUploadUrl: presign } },
        { provide: CmsAssetScanQueueService, useValue: { enqueue } },
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    feedback = moduleRef.get(QuestionFeedbackService);
    await prisma.$connect();

    for (const label of ["author", "other"]) {
      const u = await prisma.user.create({
        data: {
          email: `qf-${label}-${suffix}@example.test`,
          firstName: label === "author" ? "Asha" : "Ravi",
          lastName: "Test",
          status: "ACTIVE",
        },
      });
      userIds.push(u.id);
    }
    [authorId, otherId] = userIds as [string, string];
    courseId = (
      await prisma.course.create({
        data: { title: "QF", slug: `qf-${suffix}`, status: "PUBLISHED" },
      })
    ).id;
    const subject = await prisma.subject.create({
      data: { courseId, title: "S", slug: "s", status: "PUBLISHED" },
    });
    questionId = (
      await prisma.question.create({
        data: { subjectId: subject.id, type: "SINGLE_CHOICE", text: "Q", status: "PUBLISHED" },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.questionReport.deleteMany({ where: { questionId } });
    await prisma.questionDoubt.deleteMany({ where: { questionId } });
    await prisma.cmsAsset.deleteMany({ where: { uploadedById: { in: userIds } } });
    await prisma.question.deleteMany({ where: { id: questionId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await moduleRef.close();
  });

  it("keeps a post's kind, and replies are never explanations", async () => {
    await feedback.postDoubt(
      authorId,
      questionId,
      "**Step 1:** find genders",
      undefined,
      "EXPLANATION",
    );
    const [post] = await feedback.listDoubts(otherId, questionId);
    expect(post).toMatchObject({ kind: "EXPLANATION", body: "**Step 1:** find genders" });
    await feedback.postDoubt(otherId, questionId, "Thanks!", post!.id, "EXPLANATION");
    const reply = await prisma.questionDoubt.findFirst({ where: { parentId: post!.id } });
    expect(reply?.kind).toBe("DOUBT");
  });

  it("uploads 1 MB images under the author's own key and queues a scan", async () => {
    await expect(
      feedback.presignImage(authorId, questionId, {
        fileName: "big.png",
        mimeType: "image/png",
        sizeBytes: 1024 * 1024 + 1,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      feedback.presignImage(authorId, questionId, {
        fileName: "x.svg",
        mimeType: "image/svg+xml",
        sizeBytes: 10,
      }),
    ).rejects.toThrow(BadRequestException);

    const up = await feedback.presignImage(authorId, questionId, {
      fileName: "family tree.png",
      mimeType: "image/png",
      sizeBytes: 2048,
    });
    expect(up.key.startsWith(`doubt-images/${authorId}/`)).toBe(true);

    // Someone else can't claim the author's upload.
    await expect(
      feedback.confirmImage(otherId, {
        storageKey: up.key,
        fileName: "family tree.png",
        mimeType: "image/png",
        sizeBytes: 2048,
      }),
    ).rejects.toThrow(BadRequestException);

    const image = await feedback.confirmImage(authorId, {
      storageKey: up.key,
      fileName: "family tree.png",
      mimeType: "image/png",
      sizeBytes: 2048,
    });
    expect(image.ref).toBe(`media:${image.id}`);
    expect(enqueue).toHaveBeenCalledWith(image.id);

    // Only the uploader may use the image in a post.
    await expect(
      feedback.postDoubt(otherId, questionId, `See ![tree](${image.ref})`),
    ).rejects.toThrow(BadRequestException);
    await feedback.postDoubt(authorId, questionId, `See ![tree](${image.ref})`);
    const posts = await feedback.listDoubts(authorId, questionId);
    expect(posts.some((p) => p.body.includes(image.ref))).toBe(true);
  });

  it("reports someone else's post to moderators, but not your own", async () => {
    const post = (await feedback.listDoubts(otherId, questionId)).find(
      (p) => p.kind === "EXPLANATION",
    )!;
    await expect(feedback.reportDoubt(authorId, post.id, "Testing")).rejects.toThrow(
      BadRequestException,
    );
    await feedback.reportDoubt(otherId, post.id, "Wrong working");
    const report = await prisma.questionReport.findFirst({
      where: { questionId, userId: otherId },
    });
    expect(report?.message).toContain("Asha T.");
    expect(report?.message).toContain("Wrong working");
    // The excerpt keeps the post's words (whitespace collapsed, nothing else removed).
    expect(report?.message).toContain('"**Step 1:** find genders"');
  });
});
