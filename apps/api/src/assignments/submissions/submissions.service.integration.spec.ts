import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { STORAGE_PORT } from "../../storage/storage.port";
import { FakeStorageService } from "../../../test/support/fake-storage.service";
import { seedPublishedAssignment } from "../../../test/support/assignment-seed";
import { AssignmentCatalogService } from "../catalog/assignment-catalog.service";
import { MalwareScanQueueService } from "../malware-scan-queue.service";
import { SubmissionsService } from "./submissions.service";

describe("SubmissionsService (integration)", () => {
  let submissions: SubmissionsService;
  let prisma: PrismaService;
  let fakeStorage: FakeStorageService;
  let moduleRef: TestingModule;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        SubmissionsService,
        AssignmentCatalogService,
        PrismaService,
        { provide: STORAGE_PORT, useClass: FakeStorageService },
        // Real BullMQ isn't wired in this lightweight testing module — a
        // no-op stub is enough since these tests assert on SubmissionFile
        // rows/state transitions, not the scan job's execution (covered by
        // malware-scan.processor.spec.ts).
        { provide: MalwareScanQueueService, useValue: { enqueue: async () => undefined } },
      ],
    }).compile();
    submissions = moduleRef.get(SubmissionsService);
    prisma = moduleRef.get(PrismaService);
    fakeStorage = moduleRef.get(STORAGE_PORT);
    await prisma.$connect();

    const learner = await prisma.user.create({
      data: { email: `submission-int-${Date.now()}@example.test`, status: "ACTIVE" },
    });
    userId = learner.id;
    const other = await prisma.user.create({
      data: { email: `submission-int-other-${Date.now()}@example.test`, status: "ACTIVE" },
    });
    otherUserId = other.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await moduleRef.close();
  });

  it("starts a new submission at version 1 in DRAFT", async () => {
    const seeded = await seedPublishedAssignment(prisma);
    const submission = await submissions.start(seeded.assignmentId, userId);
    expect(submission.version).toBe(1);
    expect(submission.status).toBe("DRAFT");
    await seeded.cleanup();
  });

  it("resuming (calling start again) returns the SAME draft, not a new one", async () => {
    const seeded = await seedPublishedAssignment(prisma);
    const first = await submissions.start(seeded.assignmentId, userId);
    const second = await submissions.start(seeded.assignmentId, userId);
    expect(second.id).toBe(first.id);
    expect(second.version).toBe(1);
    await seeded.cleanup();
  });

  it("rejects file uploads outside the assignment's file rules", async () => {
    const seeded = await seedPublishedAssignment(prisma, {
      allowedMimeTypes: ["image/png"],
      maxFileSizeMb: 1,
      maxFiles: 1,
    });
    const submission = await submissions.start(seeded.assignmentId, userId);

    await expect(
      submissions.createPresignedUpload(submission.id, userId, {
        fileName: "a.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      submissions.createPresignedUpload(submission.id, userId, {
        fileName: "a.png",
        mimeType: "image/png",
        sizeBytes: 2 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await seeded.cleanup();
  });

  it("enforces maxFiles and requires >=1 file before final submit", async () => {
    const seeded = await seedPublishedAssignment(prisma, { maxFiles: 1 });
    const submission = await submissions.start(seeded.assignmentId, userId);

    await expect(submissions.submitFinal(submission.id, userId)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const presigned = await submissions.createPresignedUpload(submission.id, userId, {
      fileName: "a.png",
      mimeType: "image/png",
      sizeBytes: 1000,
    });
    fakeStorage.put(presigned.key, Buffer.from("fake-image-bytes"));
    await submissions.confirmUpload(submission.id, userId, {
      key: presigned.key,
      fileName: "a.png",
      mimeType: "image/png",
      sizeBytes: 1000,
    });

    await expect(
      submissions.createPresignedUpload(submission.id, userId, {
        fileName: "b.png",
        mimeType: "image/png",
        sizeBytes: 1000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const submitted = await submissions.submitFinal(submission.id, userId);
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.submittedAt).not.toBeNull();

    await seeded.cleanup();
  });

  it("locks editing once SUBMITTED", async () => {
    const seeded = await seedPublishedAssignment(prisma);
    const submission = await submissions.start(seeded.assignmentId, userId);
    const presigned = await submissions.createPresignedUpload(submission.id, userId, {
      fileName: "a.png",
      mimeType: "image/png",
      sizeBytes: 1000,
    });
    fakeStorage.put(presigned.key, Buffer.from("x"));
    await submissions.confirmUpload(submission.id, userId, {
      key: presigned.key,
      fileName: "a.png",
      mimeType: "image/png",
      sizeBytes: 1000,
    });
    await submissions.submitFinal(submission.id, userId);

    await expect(
      submissions.updateNotes(submission.id, userId, { notes: "too late" }),
    ).rejects.toBeInstanceOf(ConflictException);
    await seeded.cleanup();
  });

  it("a different student cannot access someone else's submission", async () => {
    const seeded = await seedPublishedAssignment(prisma);
    const submission = await submissions.start(seeded.assignmentId, userId);
    await expect(submissions.getDetail(submission.id, otherUserId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await seeded.cleanup();
  });

  it("creates a new version on resubmission after REVISION_REQUESTED", async () => {
    const seeded = await seedPublishedAssignment(prisma);
    const v1 = await submissions.start(seeded.assignmentId, userId);
    // Simulate a published REVISION_REQUESTED review directly (reviewer flow tested elsewhere).
    await prisma.assignmentSubmission.update({
      where: { id: v1.id },
      data: { status: "REVISION_REQUESTED" },
    });

    const v2 = await submissions.start(seeded.assignmentId, userId);
    expect(v2.id).not.toBe(v1.id);
    expect(v2.version).toBe(2);
    expect(v2.status).toBe("DRAFT");

    const history = await submissions.listHistory(userId, seeded.assignmentId);
    expect(history.map((h) => h.version).sort()).toEqual([1, 2]);

    await seeded.cleanup();
  });
});
