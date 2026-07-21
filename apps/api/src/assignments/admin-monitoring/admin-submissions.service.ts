import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AssignmentSubmissionStatus } from "@examora/types";
import type { Prisma } from "@examora/database";
import { PrismaService } from "../../prisma/prisma.service";

const WITH_LIST_RELATIONS = {
  assignment: { select: { title: true } },
  student: { select: { email: true } },
  reviewer: { select: { email: true } },
};

@Injectable()
export class AdminSubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    page: number;
    pageSize: number;
    assignmentId?: string;
    reviewerId?: string;
    status?: AssignmentSubmissionStatus;
  }) {
    const where: Prisma.AssignmentSubmissionWhereInput = {
      ...(params.assignmentId ? { assignmentId: params.assignmentId } : {}),
      ...(params.reviewerId ? { reviewerId: params.reviewerId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.assignmentSubmission.findMany({
        where,
        include: WITH_LIST_RELATIONS,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.assignmentSubmission.count({ where }),
    ]);
    return { items, total };
  }

  async findDetailOrThrow(id: string) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id },
      include: {
        ...WITH_LIST_RELATIONS,
        files: { orderBy: { uploadedAt: "asc" } },
        comments: {
          include: { author: { select: { email: true } } },
          orderBy: { createdAt: "asc" },
        },
        review: { include: { scores: { include: { criterion: true } } } },
      },
    });
    if (!submission) {
      throw new NotFoundException("Submission not found");
    }
    return submission;
  }

  /** Assigns/reassigns the reviewer — the reviewer must hold MENTOR or REVIEWER (ADR-0015). */
  async assignReviewer(submissionId: string, reviewerId: string) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) {
      throw new NotFoundException("Submission not found");
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: reviewerId },
      include: { role: true },
    });
    const canReview = userRoles.some(
      (ur) => ur.role.name === "MENTOR" || ur.role.name === "REVIEWER",
    );
    if (!canReview) {
      throw new BadRequestException(
        "reviewerId must belong to a user with the MENTOR or REVIEWER role",
      );
    }

    return this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { reviewerId },
      include: WITH_LIST_RELATIONS,
    });
  }
}
