import { Injectable, NotFoundException } from "@nestjs/common";
import type { ActivityTimelineItem, Student360 } from "@examora/types";
import { AdminQuizAttemptsService } from "../../assessment/admin-monitoring/admin-quiz-attempts.service";
import { toAdminAttemptSummary } from "../../assessment/assessment.mappers";
import { toSubmissionHistoryItem } from "../../assignments/assignments.mappers";
import { SubmissionsService } from "../../assignments/submissions/submissions.service";
import type { RequestUser } from "../../auth/types/request-user";
import { ProgressService } from "../../learning/progress.service";
import { PermissionsService } from "../../permissions/permissions.service";
import { PrismaService } from "../../prisma/prisma.service";
import { toUserProfile } from "../../users/user-profile.mapper";
import { UsersService } from "../../users/users.service";
import { MentorAssignmentService } from "../assignment/mentor-assignment.service";

/**
 * Read-only aggregator over Learning/Assessment/Assignment/Mentoring data for
 * one student (ADR-0016) — composes existing services rather than
 * re-implementing progress/scoring/submission queries.
 */
@Injectable()
export class Student360Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly permissionsService: PermissionsService,
    private readonly progressService: ProgressService,
    private readonly adminQuizAttemptsService: AdminQuizAttemptsService,
    private readonly submissionsService: SubmissionsService,
    private readonly assignmentService: MentorAssignmentService,
  ) {}

  async getStudent360(actor: RequestUser, studentId: string): Promise<Student360> {
    await this.assignmentService.assertAssignedOrAdmin(actor, studentId);

    const user = await this.usersService.findByIdWithRoles(studentId);
    if (!user) {
      throw new NotFoundException("Student not found");
    }
    const roles = user.roles.map((ur) => ur.role.name) as Student360["profile"]["roles"];
    const permissions = await this.permissionsService.getPermissionsForRoles(roles);
    const profile = toUserProfile(user, permissions);

    const activeMentor = await this.assignmentService.getActiveAssignment(studentId);
    const currentMentor = activeMentor
      ? { id: activeMentor.mentorId, email: activeMentor.mentor.email }
      : null;

    const learningProgress = await this.progressService.getDashboard(studentId);
    const { items: attempts } = await this.adminQuizAttemptsService.list({
      page: 1,
      pageSize: 50,
      userId: studentId,
    });
    const quizHistory = attempts.map(toAdminAttemptSummary);

    const submissions = await this.submissionsService.listHistory(studentId);
    const assignmentHistory = submissions.map(toSubmissionHistoryItem);

    const activityTimeline = await this.buildActivityTimeline(
      studentId,
      quizHistory,
      assignmentHistory,
    );

    return {
      profile,
      currentMentor,
      learningProgress,
      quizHistory,
      assignmentHistory,
      activityTimeline,
    };
  }

  private async buildActivityTimeline(
    studentId: string,
    quizHistory: Student360["quizHistory"],
    assignmentHistory: Student360["assignmentHistory"],
  ): Promise<ActivityTimelineItem[]> {
    const [completedLessons, notes, tasks, feedback, meetings] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { userId: studentId, completedAt: { not: null } },
        include: { lesson: { select: { title: true } } },
        orderBy: { completedAt: "desc" },
        take: 20,
      }),
      this.prisma.mentorNote.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.mentorTask.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.mentorFeedback.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.mentorMeeting.findMany({
        where: { studentId },
        orderBy: { occurredAt: "desc" },
        take: 20,
      }),
    ]);

    const items: ActivityTimelineItem[] = [
      ...completedLessons.map((lp) => ({
        type: "LESSON_COMPLETED" as const,
        occurredAt: (lp.completedAt as Date).toISOString(),
        title: `Completed lesson: ${lp.lesson.title}`,
        description: null,
      })),
      ...quizHistory
        .filter((attempt) => attempt.submittedAt)
        .map((attempt) => ({
          type: "QUIZ_ATTEMPT" as const,
          occurredAt: attempt.submittedAt as string,
          title: `Attempted quiz: ${attempt.quizTitle}`,
          description: attempt.percentage !== null ? `Scored ${attempt.percentage}%` : null,
        })),
      ...assignmentHistory
        .filter((submission) => submission.submittedAt)
        .map((submission) => ({
          type: "ASSIGNMENT_SUBMITTED" as const,
          occurredAt: submission.submittedAt as string,
          title: `Submitted: ${submission.assignmentTitle}`,
          description: submission.decision ? `Decision: ${submission.decision}` : null,
        })),
      ...notes.map((note) => ({
        type: "MENTOR_NOTE" as const,
        occurredAt: note.createdAt.toISOString(),
        title: "Mentor note added",
        description: null,
      })),
      ...tasks.map((task) => ({
        type: "MENTOR_TASK" as const,
        occurredAt: task.createdAt.toISOString(),
        title: `Task assigned: ${task.title}`,
        description: `Status: ${task.status}`,
      })),
      ...feedback.map((item) => ({
        type: "MENTOR_FEEDBACK" as const,
        occurredAt: item.createdAt.toISOString(),
        title: "Feedback shared",
        description: null,
      })),
      ...meetings.map((meeting) => ({
        type: "MENTOR_MEETING" as const,
        occurredAt: meeting.occurredAt.toISOString(),
        title: "Meeting logged",
        description: meeting.summary,
      })),
    ];

    return items.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)).slice(0, 50);
  }
}
