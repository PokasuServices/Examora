import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { CmsAssetScanQueueService } from "../cms/assets/cms-asset-scan-queue.service";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_PORT } from "../storage/storage.port";
import { MAX_SKETCH_VERSIONS, SketchWorksService } from "./sketch-works.service";

/** Workspace rules: test upload appears, max 4 uploads, test upload can't be deleted, access. */
describe("SketchWorksService (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let works: SketchWorksService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userIds: string[] = [];
  let ownerId: string;
  let peerId: string;
  let courseId: string;
  let quizId: string;
  let questionId: string;
  let paperId: string | undefined;
  const owner = () => ({ id: ownerId, roles: ["STUDENT"] });
  const peer = () => ({ id: peerId, roles: ["STUDENT"] });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        SketchWorksService,
        XpService,
        PrismaService,
        { provide: STORAGE_PORT, useValue: { createPresignedUploadUrl: jest.fn() } },
        { provide: CmsAssetScanQueueService, useValue: { enqueue: jest.fn() } },
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    works = moduleRef.get(SketchWorksService);
    await prisma.$connect();

    for (const label of ["owner", "peer"]) {
      const u = await prisma.user.create({
        data: { email: `sw-${label}-${suffix}@example.test`, status: "ACTIVE" },
      });
      userIds.push(u.id);
    }
    [ownerId, peerId] = userIds as [string, string];
    courseId = (
      await prisma.course.create({
        data: { title: "SW", slug: `sw-${suffix}`, status: "PUBLISHED" },
      })
    ).id;
    const subject = await prisma.subject.create({
      data: { courseId, title: "S", slug: "s", status: "PUBLISHED" },
    });
    questionId = (
      await prisma.question.create({
        data: {
          subjectId: subject.id,
          type: "UPLOAD",
          text: "Draw",
          criteria: ["Line"],
          status: "PUBLISHED",
        },
      })
    ).id;
    quizId = (
      await prisma.quiz.create({
        data: {
          subjectId: subject.id,
          title: "Sketch test",
          slug: `sw-${suffix}`,
          status: "PUBLISHED",
          quizQuestions: { create: [{ questionId, position: 0, marks: 10 }] },
        },
      })
    ).id;
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        userId: ownerId,
        status: "SUBMITTED",
        submittedAt: new Date(),
        questionSnapshot: [{ questionId, sectionId: null, marks: 10, negativeMarks: null }],
        optionOrder: {},
        passingScorePercent: 40,
        totalMarks: 10,
        negativeMarkingEnabled: false,
        negativeMarksPerWrong: 0,
      },
    });
    const testAsset = await prisma.cmsAsset.create({
      data: {
        storageKey: `test/${suffix}/test.png`,
        fileName: "test.png",
        mimeType: "image/png",
        sizeBytes: 10,
        scanStatus: "CLEAN",
        uploadedById: ownerId,
      },
    });
    await prisma.quizAttemptAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId,
        selectedOptionIds: [],
        uploadAssetId: testAsset.id,
        answeredAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.quiz.deleteMany({
      where: { id: { in: [quizId, ...(paperId ? [paperId] : [])] } },
    });
    await prisma.sketchWork.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.cmsAsset.deleteMany({ where: { uploadedById: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.question.deleteMany({ where: { id: questionId } });
    await moduleRef.close();
  });

  it("shows the test upload in the workspace once the test is finished", async () => {
    const ws = await works.workspaceForTest(owner(), quizId);
    expect(ws.finished).toBe(true);
    const work = ws.questions[0]!.work!;
    expect(work.versions.map((v) => [v.kind, v.label, v.canDelete])).toEqual([
      ["TEST", "Original", false],
    ]);
    expect(work.versions[0]!.expert).toMatchObject({ marks: null, maxMarks: 10 });
  });

  it("allows up to 4 uploads in total and never deletes the test upload", async () => {
    for (let i = 1; i < MAX_SKETCH_VERSIONS; i++) {
      const work = await works.confirmVersion(ownerId, questionId, {
        storageKey: `sketch-works/${ownerId}/${questionId}/r${i}-${suffix}.png`,
        fileName: `r${i}.png`,
        mimeType: "image/png",
        sizeBytes: 10,
        description: `rev ${i}`,
      });
      expect(work.versions).toHaveLength(i + 1);
    }
    await expect(
      works.presignVersion(ownerId, questionId, {
        fileName: "x.png",
        mimeType: "image/png",
        sizeBytes: 10,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const ws = await works.workspaceForTest(owner(), quizId);
    const versions = ws.questions[0]!.work!.versions;
    expect(versions.map((v) => v.label)).toEqual([
      "Original",
      "Revision 1",
      "Revision 2",
      "Revision 3",
    ]);
    await expect(works.deleteVersion(ownerId, versions[0]!.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const after = await works.deleteVersion(ownerId, versions[3]!.id);
    expect(after.versions).toHaveLength(3);
    expect(after.canUpload).toBe(true);
  });

  it("keeps other students out until they've uploaded their own sketch; no self-claps or self-reports", async () => {
    const workId = (await works.workspaceForTest(owner(), quizId)).questions[0]!.work!.id;
    await expect(works.getWork(peer(), workId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(works.toggleClap(owner(), workId)).rejects.toBeInstanceOf(BadRequestException);
    await expect(works.report(owner(), workId, "nope")).rejects.toBeInstanceOf(BadRequestException);

    const commented = await works.addComment(owner(), workId, "Notes to self");
    expect(commented.comments.map((c) => [c.body, c.authorKind, c.mine])).toEqual([
      ["Notes to self", "OWNER", true],
    ]);

    // A reviewer may open it (counted as a view) and pin a comment on a version.
    const mentorRole = await prisma.role.findUniqueOrThrow({ where: { name: "MENTOR" } });
    await prisma.userRole.create({ data: { userId: peerId, roleId: mentorRole.id } });
    const staff = { id: peerId, roles: ["MENTOR"] };
    const seen = await works.getWork(staff, workId);
    const pins = await works.addPin(staff, seen.versions[1]!.id, { x: 0.2, y: 0.3, body: "Here" });
    expect(pins.map((p) => p.authorKind)).toEqual(["EXPERT"]);
    expect((await works.getWork(owner(), workId)).views).toBe(1);
  });

  it("rates once per version (+10 XP), unlocks the community, and takes peer feedback (+25 XP)", async () => {
    const xp = moduleRef.get(XpService);
    // The peer finishes the test with their own sketch.
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        userId: peerId,
        status: "SUBMITTED",
        submittedAt: new Date(),
        questionSnapshot: [{ questionId, sectionId: null, marks: 10, negativeMarks: null }],
        optionOrder: {},
        passingScorePercent: 40,
        totalMarks: 10,
        negativeMarkingEnabled: false,
        negativeMarksPerWrong: 0,
      },
    });
    const peerAsset = await prisma.cmsAsset.create({
      data: {
        storageKey: `test/${suffix}/peer.png`,
        fileName: "peer.png",
        mimeType: "image/png",
        sizeBytes: 10,
        scanStatus: "CLEAN",
        uploadedById: peerId,
      },
    });
    await prisma.quizAttemptAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId,
        selectedOptionIds: [],
        uploadAssetId: peerAsset.id,
      },
    });

    // Unlocked as soon as the peer has uploaded their own sketch; rating it is optional.
    expect(
      (await works.community(peer(), questionId, { sort: "newest", filter: "all", page: 1 }))
        .unlocked,
    ).toBe(true);
    const peerWork = (await works.workspaceForTest(peer(), quizId)).questions[0]!.work!;
    const before = await xp.getTotal(peerId);
    const rated = await works.rateSelf(peerId, peerWork.versions[0]!.id, { Line: 4 });
    expect(rated.xpAwarded).toBe(10);
    expect(rated.work.versions[0]!.ratings.self).toEqual({ scores: { Line: 4 }, total: 8 });
    await expect(
      works.rateSelf(peerId, peerWork.versions[0]!.id, { Line: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);

    const page = await works.community(peer(), questionId, {
      sort: "newest",
      filter: "all",
      page: 1,
    });
    expect(page.unlocked).toBe(true);
    // Only the owner's scanned (clean) test upload is shown; pending revisions are hidden.
    expect(page.items.map((c) => c.versionLabel)).toEqual(["Original"]);

    const ownerWork = await works.getWork(peer(), page.items[0]!.workId);
    const fb = await works.peerFeedback(peer(), ownerWork.versions[0]!.id, {
      likedFactors: ["Line"],
      comment: "Clean lines",
    });
    expect(fb.xpAwarded).toBe(25);
    expect(fb.work.versions[0]!.ratings.community).toMatchObject({
      count: 1,
      likes: { Line: 1 },
      total: 10,
    });
    expect(fb.work.versions[0]!.ratings.myFeedback).toEqual({
      likedFactors: ["Line"],
      comment: "Clean lines",
    });
    await expect(
      works.peerFeedback(peer(), ownerWork.versions[0]!.id, { likedFactors: ["Line"] }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      works.peerFeedback(peer(), ownerWork.versions[0]!.id, { likedFactors: ["Nope"] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await xp.getTotal(peerId)).toBe(before + 35);

    // Reviewers give feedback on revisions; the test upload is marked in Sketch review.
    const staff = { id: peerId, roles: ["MENTOR"] };
    await expect(
      works.expertRate(staff, ownerWork.versions[0]!.id, { scores: { Line: 3 } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await works.expertRate(staff, ownerWork.versions[1]!.id, {
      scores: { Line: 3 },
      comment: "Better",
    });
    const mine = await works.getWork(owner(), ownerWork.id);
    expect(mine.versions[1]!.ratings.expert).toMatchObject({
      count: 1,
      total: 6,
      scores: { Line: 3 },
    });
    const queue = await works.revisionQueue(staff, "reviewed");
    expect(queue.some((q) => q.versionId === ownerWork.versions[1]!.id)).toBe(true);
  });

  it("Part B: in a licensed practice paper the first upload is the original, in that paper's marks", async () => {
    const student = await prisma.user.create({
      data: { email: `sw-partb-${suffix}@example.test`, status: "ACTIVE" },
    });
    userIds.push(student.id);
    const me = { id: student.id, roles: ["STUDENT"] };
    const { subjectId } = await prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      select: { subjectId: true },
    });
    const category = await prisma.practiceCategory.create({
      data: { courseId, title: "Past papers", slug: `pp-${suffix}` },
    });
    paperId = (
      await prisma.quiz.create({
        data: {
          subjectId,
          practiceCategoryId: category.id,
          title: "Paper",
          slug: `swp-${suffix}`,
          status: "PUBLISHED",
          quizQuestions: { create: [{ questionId, position: 0, marks: 50 }] },
        },
      })
    ).id;
    const file = (n: number) => ({
      storageKey: `sketch-works/${student.id}/${questionId}/p${n}-${suffix}.png`,
      fileName: `p${n}.png`,
      mimeType: "image/png",
      sizeBytes: 10,
    });

    // No licence for the course: no upload. With one: no test needed (Part B is untimed).
    await expect(
      works.confirmVersion(student.id, questionId, file(1), paperId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await prisma.enrollment.create({ data: { userId: student.id, courseId, status: "ACTIVE" } });
    const first = await works.confirmVersion(student.id, questionId, file(1), paperId);
    expect(first.versions.map((v) => [v.kind, v.label, v.canDelete])).toEqual([
      ["TEST", "Original", true],
    ]);
    expect(first.maxMarks).toBe(50);
    const ws = await works.workspaceForTest(me, paperId);
    expect(ws.finished).toBe(false);
    expect(ws.questions[0]).toMatchObject({ marks: 50, canUpload: true });
    expect(ws.questions[0]!.work!.maxMarks).toBe(50);

    // Experts rate the original directly; once rated it can't be deleted.
    const staff = { id: peerId, roles: ["MENTOR"] };
    await works.expertRate(staff, first.versions[0]!.id, { scores: { Line: 4 }, comment: "Good" });
    const rated = await works.getWork({ ...me, quizId: paperId }, first.id);
    expect(rated.versions[0]!.ratings.expert).toMatchObject({ count: 1, total: 40 });
    expect(rated.versions[0]!.canDelete).toBe(false);
    await expect(works.deleteVersion(student.id, first.versions[0]!.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const queue = await works.revisionQueue(staff, "reviewed");
    expect(queue.find((q) => q.versionId === first.versions[0]!.id)?.label).toBe("Original");

    const second = await works.confirmVersion(student.id, questionId, file(2), paperId);
    expect(second.versions.map((v) => v.label)).toEqual(["Original", "Revision 1"]);
  });
});
