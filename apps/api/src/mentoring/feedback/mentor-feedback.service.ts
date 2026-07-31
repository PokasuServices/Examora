import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../auth/types/request-user";
import { MentorAssignmentService } from "../assignment/mentor-assignment.service";
import type { CreateFeedbackDto } from "./dto/create-feedback.dto";

const FEEDBACK_INCLUDE = { mentor: { select: { email: true } } } as const;

/** Feedback a mentor shares with a student — distinct from a private MentorNote (ADR-0016). */
@Injectable()
export class MentorFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentService: MentorAssignmentService,
  ) {}

  async list(actor: RequestUser, studentId: string) {
    await this.assignmentService.assertAssignedOrAdmin(actor, studentId);
    return this.prisma.mentorFeedback.findMany({
      where: { studentId },
      include: FEEDBACK_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async create(actor: RequestUser, studentId: string, dto: CreateFeedbackDto) {
    await this.assignmentService.assertAssignedOrAdmin(actor, studentId);
    return this.prisma.mentorFeedback.create({
      data: { studentId, mentorId: actor.id, body: dto.body },
      include: FEEDBACK_INCLUDE,
    });
  }

  /**
   * A student reading their own feedback — unlike list(), there is no
   * assignment check to make, since the caller can only ever be the student
   * themselves (RecommendationService, ADR-0021 §2, always passes the
   * authenticated user's own id). Only recency/count is used as an
   * engagement signal — the feedback text itself is not analyzed.
   */
  async listRecentForStudent(studentId: string, limit = 5) {
    return this.prisma.mentorFeedback.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
