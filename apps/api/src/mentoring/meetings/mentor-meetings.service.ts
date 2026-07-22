import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../auth/types/request-user";
import { MentorAssignmentService } from "../assignment/mentor-assignment.service";
import type { CreateMeetingDto } from "./dto/create-meeting.dto";

const MEETING_INCLUDE = { mentor: { select: { email: true } } } as const;

/** A logged 1:1 mentor-student meeting — manually recorded, no calendar integration (ADR-0016). */
@Injectable()
export class MentorMeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentService: MentorAssignmentService,
  ) {}

  async list(actor: RequestUser, studentId: string) {
    await this.assignmentService.assertAssignedOrAdmin(actor, studentId);
    return this.prisma.mentorMeeting.findMany({
      where: { studentId },
      include: MEETING_INCLUDE,
      orderBy: { occurredAt: "desc" },
    });
  }

  async create(actor: RequestUser, studentId: string, dto: CreateMeetingDto) {
    await this.assignmentService.assertAssignedOrAdmin(actor, studentId);
    return this.prisma.mentorMeeting.create({
      data: {
        studentId,
        mentorId: actor.id,
        occurredAt: new Date(dto.occurredAt),
        durationMinutes: dto.durationMinutes,
        summary: dto.summary,
      },
      include: MEETING_INCLUDE,
    });
  }
}
