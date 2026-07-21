import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AssignmentSubmissionStatus, ReviewDecision } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import { decToNum } from "../assignments.mappers";
import type { SaveReviewDto } from "./dto/save-review.dto";

const WITH_REVIEW_CONTEXT = {
  assignment: { include: { criteria: { orderBy: { position: "asc" as const } } } },
  files: { orderBy: { uploadedAt: "asc" as const } },
  comments: {
    include: { author: { select: { email: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  review: { include: { scores: { include: { criterion: true } } } },
};

@Injectable()
export class ReviewerService {
  constructor(private readonly prisma: PrismaService) {}

  async listQueue(
    reviewerId: string,
    params: { page: number; pageSize: number; status?: AssignmentSubmissionStatus },
  ) {
    const where = {
      reviewerId,
      ...(params.status ? { status: params.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.assignmentSubmission.findMany({
        where,
        include: { assignment: { select: { title: true } }, student: { select: { email: true } } },
        orderBy: { submittedAt: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.assignmentSubmission.count({ where }),
    ]);
    return { items, total };
  }

  /** Full context for review — unlike the shared student/reviewer detail endpoint, this always
   *  includes the review regardless of DRAFT/PUBLISHED, since only the assigned reviewer can call it. */
  async getSubmissionForReview(submissionId: string, reviewerId: string) {
    const submission = await this.findAssignedOrThrow(submissionId, reviewerId);
    return this.prisma.assignmentSubmission.findUniqueOrThrow({
      where: { id: submission.id },
      include: WITH_REVIEW_CONTEXT,
    });
  }

  /** Upserts a DRAFT review with the given scores — saves progress without publishing/notifying the student. */
  async saveDraft(submissionId: string, reviewerId: string, dto: SaveReviewDto) {
    const submission = await this.findAssignedOrThrow(submissionId, reviewerId);
    if (submission.status !== "SUBMITTED" && submission.status !== "UNDER_REVIEW") {
      throw new ConflictException("This submission is not awaiting review");
    }
    await this.assertScoresValid(submission.assignmentId, dto.scores);

    await this.prisma.$transaction(async (tx) => {
      const review = await tx.assignmentReview.upsert({
        where: { submissionId },
        update: { overallComment: dto.overallComment },
        create: { submissionId, reviewerId, overallComment: dto.overallComment },
      });
      for (const s of dto.scores) {
        await tx.rubricScore.upsert({
          where: { reviewId_criterionId: { reviewId: review.id, criterionId: s.criterionId } },
          update: { marksAwarded: s.marksAwarded, comment: s.comment },
          create: {
            reviewId: review.id,
            criterionId: s.criterionId,
            marksAwarded: s.marksAwarded,
            comment: s.comment,
          },
        });
      }
      if (submission.status === "SUBMITTED") {
        await tx.assignmentSubmission.update({
          where: { id: submissionId },
          data: { status: "UNDER_REVIEW" },
        });
      }
    });

    return this.getSubmissionForReview(submissionId, reviewerId);
  }

  /** Publishes the review: sums scores into obtainedMarks, records the decision, flips the submission status. */
  async publish(submissionId: string, reviewerId: string, decision: ReviewDecision) {
    const submission = await this.findAssignedOrThrow(submissionId, reviewerId);
    const review = await this.prisma.assignmentReview.findUnique({
      where: { submissionId },
      include: { scores: true },
    });
    if (!review) {
      throw new BadRequestException("Save rubric scores before publishing a review");
    }

    const assignment = await this.prisma.assignment.findUniqueOrThrow({
      where: { id: submission.assignmentId },
      include: { criteria: true },
    });
    const scoredCriteriaIds = new Set(review.scores.map((s) => s.criterionId));
    const missing = assignment.criteria.filter((c) => !scoredCriteriaIds.has(c.id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Score every criterion before publishing (missing: ${missing.map((c) => c.title).join(", ")})`,
      );
    }

    const obtainedMarks = review.scores.reduce((sum, s) => sum + decToNum(s.marksAwarded), 0);

    await this.prisma.$transaction([
      this.prisma.assignmentReview.update({
        where: { id: review.id },
        data: { status: "PUBLISHED", decision, obtainedMarks, publishedAt: new Date() },
      }),
      this.prisma.assignmentSubmission.update({
        where: { id: submissionId },
        data: { status: decision === "APPROVED" ? "APPROVED" : "REVISION_REQUESTED" },
      }),
    ]);

    return this.getSubmissionForReview(submissionId, reviewerId);
  }

  private async findAssignedOrThrow(submissionId: string, reviewerId: string) {
    const submission = await this.prisma.assignmentSubmission.findFirst({
      where: { id: submissionId, reviewerId },
    });
    if (!submission) {
      throw new NotFoundException("Submission not found");
    }
    return submission;
  }

  private async assertScoresValid(
    assignmentId: string,
    scores: { criterionId: string; marksAwarded: number }[],
  ): Promise<void> {
    const criteria = await this.prisma.rubricCriterion.findMany({ where: { assignmentId } });
    const byId = new Map(criteria.map((c) => [c.id, c]));
    for (const s of scores) {
      const criterion = byId.get(s.criterionId);
      if (!criterion) {
        throw new BadRequestException(
          `criterionId ${s.criterionId} does not belong to this assignment`,
        );
      }
      if (s.marksAwarded < 0 || s.marksAwarded > decToNum(criterion.maxMarks)) {
        throw new BadRequestException(
          `marksAwarded for "${criterion.title}" must be between 0 and ${decToNum(criterion.maxMarks)}`,
        );
      }
    }
  }
}
