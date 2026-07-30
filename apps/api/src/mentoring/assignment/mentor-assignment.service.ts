import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { NotificationsService } from "../../notifications/notifications.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../auth/types/request-user";

const ASSIGNMENT_RELATIONS = {
  student: { select: { email: true } },
  mentor: { select: { email: true } },
} as const;

/**
 * History-preserving mentor↔student assignment (ADR-0016): reassigning a
 * student sets `unassignedAt` on the current active row and inserts a new
 * one — rows are never edited or deleted. "At most one active mentor per
 * student" is enforced here, not by a DB constraint.
 */
@Injectable()
export class MentorAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getActiveAssignment(studentId: string) {
    return this.prisma.mentorAssignment.findFirst({
      where: { studentId, unassignedAt: null },
      include: ASSIGNMENT_RELATIONS,
    });
  }

  async getActiveMentorId(studentId: string): Promise<string | null> {
    const active = await this.prisma.mentorAssignment.findFirst({
      where: { studentId, unassignedAt: null },
      select: { mentorId: true },
    });
    return active?.mentorId ?? null;
  }

  /**
   * Throws unless `actor` is an ADMINISTRATOR or the student's current active
   * mentor — the ownership check every mentor-workflow service (notes,
   * tasks, feedback, meetings, Student 360) delegates to (ADR-0016).
   */
  async assertAssignedOrAdmin(actor: RequestUser, studentId: string): Promise<void> {
    if (actor.roles.includes("ADMINISTRATOR")) return;
    const activeMentorId = await this.getActiveMentorId(studentId);
    if (activeMentorId !== actor.id) {
      throw new ForbiddenException("You are not this student's assigned mentor");
    }
  }

  async listAssignedStudentIds(mentorId: string): Promise<string[]> {
    const rows = await this.prisma.mentorAssignment.findMany({
      where: { mentorId, unassignedAt: null },
      select: { studentId: true },
    });
    return rows.map((r) => r.studentId);
  }

  async assign(studentId: string, mentorId: string, assignedById: string) {
    const student = await this.prisma.user.findUnique({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const mentorRoles = await this.prisma.userRole.findMany({
      where: { userId: mentorId },
      include: { role: true },
    });
    if (!mentorRoles.some((ur) => ur.role.name === "MENTOR")) {
      throw new BadRequestException("mentorId must belong to a user with the MENTOR role");
    }

    const assignment = await this.prisma.$transaction(async (tx) => {
      await tx.mentorAssignment.updateMany({
        where: { studentId, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });
      return tx.mentorAssignment.create({
        data: { studentId, mentorId, assignedById },
        include: ASSIGNMENT_RELATIONS,
      });
    });

    await this.notificationsService.enqueue({
      userId: studentId,
      eventType: "mentor.assigned",
      category: "mentoring",
      title: "You have a new mentor",
      body: `${assignment.mentor.email} is now your assigned mentor.`,
      data: { mentorId },
      channels: ["EMAIL"],
    });
    await this.notificationsService.enqueue({
      userId: mentorId,
      eventType: "mentor.assigned",
      category: "mentoring",
      title: "New student assigned",
      body: `${assignment.student.email} has been assigned to your caseload.`,
      data: { studentId },
      channels: ["EMAIL"],
    });

    return assignment;
  }

  async unassign(studentId: string): Promise<void> {
    const active = await this.getActiveAssignment(studentId);
    if (!active) {
      throw new NotFoundException("Student has no active mentor assignment");
    }
    await this.prisma.mentorAssignment.update({
      where: { id: active.id },
      data: { unassignedAt: new Date() },
    });
  }

  async listHistory(params: {
    studentId?: string;
    mentorId?: string;
    page: number;
    pageSize: number;
  }) {
    const where = {
      ...(params.studentId ? { studentId: params.studentId } : {}),
      ...(params.mentorId ? { mentorId: params.mentorId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mentorAssignment.findMany({
        where,
        include: ASSIGNMENT_RELATIONS,
        orderBy: { assignedAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.mentorAssignment.count({ where }),
    ]);
    return { items, total };
  }

  async getWorkload(mentorId: string): Promise<number> {
    return this.prisma.mentorAssignment.count({ where: { mentorId, unassignedAt: null } });
  }
}
