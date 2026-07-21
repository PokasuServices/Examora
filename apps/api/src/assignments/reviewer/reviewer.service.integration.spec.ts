import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { seedPublishedAssignment } from "../../../test/support/assignment-seed";
import { ReviewerService } from "./reviewer.service";

describe("ReviewerService (integration)", () => {
  let reviewer: ReviewerService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let reviewerId: string;
  let otherReviewerId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [ReviewerService, PrismaService],
    }).compile();
    reviewer = moduleRef.get(ReviewerService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const student = await prisma.user.create({
      data: { email: `reviewer-int-student-${Date.now()}@example.test`, status: "ACTIVE" },
    });
    studentId = student.id;
    const rev = await prisma.user.create({
      data: { email: `reviewer-int-reviewer-${Date.now()}@example.test`, status: "ACTIVE" },
    });
    reviewerId = rev.id;
    const otherRev = await prisma.user.create({
      data: { email: `reviewer-int-other-${Date.now()}@example.test`, status: "ACTIVE" },
    });
    otherReviewerId = otherRev.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [studentId, reviewerId, otherReviewerId] } },
    });
    await moduleRef.close();
  });

  async function seedAssignedSubmission(criterionCount = 2) {
    const seeded = await seedPublishedAssignment(prisma, {
      criterionCount,
      maxMarksPerCriterion: 10,
    });
    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId: seeded.assignmentId,
        studentId,
        reviewerId,
        version: 1,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });
    return { seeded, submission };
  }

  it("a reviewer not assigned to the submission gets 404", async () => {
    const { seeded, submission } = await seedAssignedSubmission();
    await expect(
      reviewer.saveDraft(submission.id, otherReviewerId, { scores: [] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await seeded.cleanup();
  });

  it("rejects a score above the criterion's maxMarks", async () => {
    const { seeded, submission } = await seedAssignedSubmission(1);
    await expect(
      reviewer.saveDraft(submission.id, reviewerId, {
        scores: [{ criterionId: seeded.criterionIds[0]!, marksAwarded: 999 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await seeded.cleanup();
  });

  it("saving a draft moves SUBMITTED to UNDER_REVIEW without publishing", async () => {
    const { seeded, submission } = await seedAssignedSubmission(2);
    const result = await reviewer.saveDraft(submission.id, reviewerId, {
      overallComment: "Looking good so far",
      scores: [{ criterionId: seeded.criterionIds[0]!, marksAwarded: 7, comment: "solid" }],
    });
    expect(result.status).toBe("UNDER_REVIEW");
    expect(result.review?.status).toBe("DRAFT");
    expect(result.review?.scores).toHaveLength(1);
    await seeded.cleanup();
  });

  it("refuses to publish until every criterion is scored", async () => {
    const { seeded, submission } = await seedAssignedSubmission(2);
    await reviewer.saveDraft(submission.id, reviewerId, {
      scores: [{ criterionId: seeded.criterionIds[0]!, marksAwarded: 5 }],
    });
    await expect(reviewer.publish(submission.id, reviewerId, "APPROVED")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await seeded.cleanup();
  });

  it("publishing sums marks, sets the decision, and flips the submission to APPROVED", async () => {
    const { seeded, submission } = await seedAssignedSubmission(2);
    await reviewer.saveDraft(submission.id, reviewerId, {
      scores: [
        { criterionId: seeded.criterionIds[0]!, marksAwarded: 8 },
        { criterionId: seeded.criterionIds[1]!, marksAwarded: 6 },
      ],
    });
    const result = await reviewer.publish(submission.id, reviewerId, "APPROVED");

    expect(result.status).toBe("APPROVED");
    expect(result.review?.status).toBe("PUBLISHED");
    expect(result.review?.decision).toBe("APPROVED");
    expect(Number(result.review?.obtainedMarks)).toBe(14);
    await seeded.cleanup();
  });

  it("publishing REVISION_REQUESTED flips the submission accordingly", async () => {
    const { seeded, submission } = await seedAssignedSubmission(1);
    await reviewer.saveDraft(submission.id, reviewerId, {
      scores: [{ criterionId: seeded.criterionIds[0]!, marksAwarded: 3 }],
    });
    const result = await reviewer.publish(submission.id, reviewerId, "REVISION_REQUESTED");
    expect(result.status).toBe("REVISION_REQUESTED");
    expect(result.review?.decision).toBe("REVISION_REQUESTED");
    await seeded.cleanup();
  });

  it("lists the reviewer's queue filtered by status", async () => {
    const { seeded, submission } = await seedAssignedSubmission(1);
    const { items } = await reviewer.listQueue(reviewerId, {
      page: 1,
      pageSize: 50,
      status: "SUBMITTED",
    });
    expect(items.some((i) => i.id === submission.id)).toBe(true);
    await seeded.cleanup();
  });
});
