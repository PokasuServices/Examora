import { Injectable } from "@nestjs/common";
import type { AssignedStudentSummary, MentorDashboard } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import {
  toAssignedStudentSummary,
  toMentorMeeting,
  toMentorProfile,
  toMentorTask,
} from "../mentoring.mappers";
import { MentorAssignmentService } from "../assignment/mentor-assignment.service";
import { MentorProfilesService } from "../mentor-profiles/mentor-profiles.service";

const MEETING_INCLUDE = { mentor: { select: { email: true } } } as const;
const TASK_INCLUDE = { mentor: { select: { email: true } } } as const;

/** A mentor's own dashboard: caseload, workload, and near-term work (ADR-0016). */
@Injectable()
export class MentorDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentService: MentorAssignmentService,
    private readonly mentorProfilesService: MentorProfilesService,
  ) {}

  async listAssignedStudents(mentorId: string): Promise<AssignedStudentSummary[]> {
    const rows = await this.prisma.mentorAssignment.findMany({
      where: { mentorId, unassignedAt: null },
      include: { student: { select: { email: true, firstName: true, lastName: true } } },
      orderBy: { assignedAt: "desc" },
    });
    return rows.map(toAssignedStudentSummary);
  }

  async getDashboard(mentorId: string): Promise<MentorDashboard> {
    const profileRow = await this.mentorProfilesService.findByUserIdOrThrow(mentorId);
    const activeStudentCount = await this.assignmentService.getWorkload(mentorId);
    const profile = toMentorProfile(profileRow, activeStudentCount);

    const assignedStudents = await this.listAssignedStudents(mentorId);
    const studentIds = assignedStudents.map((s) => s.studentId);

    const [pendingTaskCount, upcomingTaskRows, recentMeetingRows] = await Promise.all([
      this.prisma.mentorTask.count({
        where: { studentId: { in: studentIds }, status: { in: ["PENDING", "IN_PROGRESS"] } },
      }),
      this.prisma.mentorTask.findMany({
        where: { studentId: { in: studentIds }, status: { in: ["PENDING", "IN_PROGRESS"] } },
        include: TASK_INCLUDE,
        orderBy: { dueDate: "asc" },
        take: 10,
      }),
      this.prisma.mentorMeeting.findMany({
        where: { studentId: { in: studentIds } },
        include: MEETING_INCLUDE,
        orderBy: { occurredAt: "desc" },
        take: 10,
      }),
    ]);

    return {
      profile,
      assignedStudents,
      pendingTaskCount,
      upcomingTasks: upcomingTaskRows.map(toMentorTask),
      recentMeetings: recentMeetingRows.map(toMentorMeeting),
    };
  }
}
