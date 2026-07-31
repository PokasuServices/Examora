import { BadRequestException, Injectable } from "@nestjs/common";
import type { ReportResult, ReportRow, ReportType } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminAcademicAnalyticsService } from "../admin/admin-academic-analytics.service";
import { AdminEngagementAnalyticsService } from "../admin/admin-engagement-analytics.service";

export interface ReportFilters {
  from?: string;
  to?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 500;

/**
 * Computes a tabular {columns, rows} result for each ReportType (ADR-0020
 * §4) — the same shape both the on-screen Report Builder and the CSV/PDF
 * export render. Reuses the admin analytics services for report types whose
 * row shape is naturally one row per course/mentor/channel; the remaining
 * "raw list" report types (individual enrollments/payments/threads/etc.) are
 * new, bounded (date-filtered, capped) queries.
 */
@Injectable()
export class ReportBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly academicAnalytics: AdminAcademicAnalyticsService,
    private readonly engagementAnalytics: AdminEngagementAnalyticsService,
  ) {}

  async build(reportType: ReportType, filters: ReportFilters = {}): Promise<ReportResult> {
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, 5000);
    const range = this.dateRange(filters);

    const { columns, rows } = await this.rowsFor(reportType, range, limit);
    return { reportType, generatedAt: new Date().toISOString(), columns, rows };
  }

  private dateRange(filters: ReportFilters): { gte?: Date; lte?: Date } {
    const range: { gte?: Date; lte?: Date } = {};
    if (filters.from) {
      const from = new Date(filters.from);
      if (Number.isNaN(from.getTime())) throw new BadRequestException("Invalid 'from' date");
      range.gte = from;
    }
    if (filters.to) {
      const to = new Date(filters.to);
      if (Number.isNaN(to.getTime())) throw new BadRequestException("Invalid 'to' date");
      range.lte = to;
    }
    return range;
  }

  private async rowsFor(
    reportType: ReportType,
    range: { gte?: Date; lte?: Date },
    limit: number,
  ): Promise<{ columns: string[]; rows: ReportRow[] }> {
    switch (reportType) {
      case "STUDENT_PROGRESS":
        return this.studentProgressRows(limit);
      case "COURSE_COMPLETION":
        return this.courseCompletionRows(limit);
      case "COURSE_PERFORMANCE": {
        const entries = await this.academicAnalytics.getCoursePerformance();
        return {
          columns: [
            "courseId",
            "courseTitle",
            "enrollmentCount",
            "averageCompletionPercent",
            "averageQuizPercentage",
            "revenue",
          ],
          rows: entries.slice(0, limit) as unknown as ReportRow[],
        };
      }
      case "MENTOR_PERFORMANCE": {
        const entries = await this.academicAnalytics.getMentorPerformance();
        return {
          columns: [
            "mentorId",
            "mentorEmail",
            "activeStudentCount",
            "averageStudentCompletionPercent",
            "pendingReviewCount",
            "averageReviewTurnaroundHours",
          ],
          rows: entries.slice(0, limit) as unknown as ReportRow[],
        };
      }
      case "QUIZ_PERFORMANCE":
        return this.quizPerformanceRows(limit);
      case "ASSIGNMENT_PERFORMANCE":
        return this.assignmentPerformanceRows(limit);
      case "ENROLLMENT":
        return this.enrollmentRows(range, limit);
      case "REVENUE":
        return this.revenueRows(range, limit);
      case "COMMUNITY_ACTIVITY":
        return this.communityActivityRows(range, limit);
      case "NOTIFICATION_DELIVERY": {
        const analytics = await this.engagementAnalytics.getNotificationDeliveryAnalytics();
        return {
          columns: ["channel", "queued", "delivered", "failed", "suppressed", "successRate"],
          rows: analytics.deliveryByChannel,
        };
      }
      default: {
        const exhaustive: never = reportType;
        throw new BadRequestException(`Unknown report type: ${String(exhaustive)}`);
      }
    }
  }

  private async studentProgressRows(limit: number) {
    const students = await this.prisma.user.findMany({
      where: { roles: { some: { role: { name: "STUDENT" } } } },
      select: { id: true, email: true },
      take: limit,
    });
    const studentIds = students.map((s) => s.id);
    const [enrollCounts, completedCounts] = await Promise.all([
      this.prisma.enrollment.groupBy({
        by: ["userId"],
        where: { userId: { in: studentIds }, status: "ACTIVE" },
        _count: true,
      }),
      this.prisma.lessonProgress.groupBy({
        by: ["userId"],
        where: { userId: { in: studentIds }, completedAt: { not: null } },
        _count: true,
      }),
    ]);
    const enrollByUser = new Map(enrollCounts.map((r) => [r.userId, r._count]));
    const completedByUser = new Map(completedCounts.map((r) => [r.userId, r._count]));

    return {
      columns: ["studentId", "email", "activeEnrollments", "lessonsCompleted"],
      rows: students.map((s) => ({
        studentId: s.id,
        email: s.email,
        activeEnrollments: enrollByUser.get(s.id) ?? 0,
        lessonsCompleted: completedByUser.get(s.id) ?? 0,
      })),
    };
  }

  private async courseCompletionRows(limit: number) {
    const rows = await this.prisma.lessonProgress.findMany({
      where: { completedAt: { not: null } },
      include: { user: { select: { email: true } }, course: { select: { title: true } } },
      orderBy: { completedAt: "desc" },
      take: limit,
    });
    return {
      columns: ["studentEmail", "courseTitle", "lessonId", "completedAt"],
      rows: rows.map((r) => ({
        studentEmail: r.user.email,
        courseTitle: r.course.title,
        lessonId: r.lessonId,
        completedAt: r.completedAt!.toISOString(),
      })),
    };
  }

  private async quizPerformanceRows(limit: number) {
    const grouped = await this.prisma.quizAttempt.groupBy({
      by: ["quizId"],
      where: { percentage: { not: null } },
      _count: true,
      _avg: { percentage: true },
      orderBy: { _count: { quizId: "desc" } },
      take: limit,
    });
    const quizzes = await this.prisma.quiz.findMany({
      where: { id: { in: grouped.map((g) => g.quizId) } },
      select: { id: true, title: true },
    });
    const titleById = new Map(quizzes.map((q) => [q.id, q.title]));

    return {
      columns: ["quizId", "quizTitle", "attemptCount", "averagePercentage"],
      rows: grouped.map((g) => ({
        quizId: g.quizId,
        quizTitle: titleById.get(g.quizId) ?? g.quizId,
        attemptCount: g._count,
        averagePercentage: g._avg.percentage === null ? null : Number(g._avg.percentage),
      })),
    };
  }

  private async assignmentPerformanceRows(limit: number) {
    const assignments = await this.prisma.assignment.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        title: true,
        _count: { select: { submissions: true } },
      },
      take: limit,
    });

    return {
      columns: ["assignmentId", "assignmentTitle", "submissionCount"],
      rows: assignments.map((a) => ({
        assignmentId: a.id,
        assignmentTitle: a.title,
        submissionCount: a._count.submissions,
      })),
    };
  }

  private async enrollmentRows(range: { gte?: Date; lte?: Date }, limit: number) {
    const rows = await this.prisma.enrollment.findMany({
      where: Object.keys(range).length ? { enrolledAt: range } : {},
      include: { user: { select: { email: true } }, course: { select: { title: true } } },
      orderBy: { enrolledAt: "desc" },
      take: limit,
    });
    return {
      columns: ["enrollmentId", "studentEmail", "courseTitle", "status", "source", "enrolledAt"],
      rows: rows.map((r) => ({
        enrollmentId: r.id,
        studentEmail: r.user.email,
        courseTitle: r.course.title,
        status: r.status,
        source: r.source,
        enrolledAt: r.enrolledAt.toISOString(),
      })),
    };
  }

  private async revenueRows(range: { gte?: Date; lte?: Date }, limit: number) {
    const rows = await this.prisma.payment.findMany({
      where: {
        status: "CAPTURED",
        ...(Object.keys(range).length ? { verifiedAt: range } : {}),
      },
      include: {
        order: {
          include: { user: { select: { email: true } }, course: { select: { title: true } } },
        },
      },
      orderBy: { verifiedAt: "desc" },
      take: limit,
    });
    return {
      columns: ["paymentId", "studentEmail", "courseTitle", "amount", "currency", "verifiedAt"],
      rows: rows.map((r) => ({
        paymentId: r.id,
        studentEmail: r.order.user.email,
        courseTitle: r.order.course.title,
        amount: Number(r.amount),
        currency: r.currency,
        verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
      })),
    };
  }

  private async communityActivityRows(range: { gte?: Date; lte?: Date }, limit: number) {
    const rows = await this.prisma.thread.findMany({
      where: { deletedAt: null, ...(Object.keys(range).length ? { createdAt: range } : {}) },
      include: {
        author: { select: { email: true } },
        board: { select: { title: true } },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return {
      columns: [
        "threadId",
        "title",
        "authorEmail",
        "boardName",
        "repliesCount",
        "isSolved",
        "createdAt",
      ],
      rows: rows.map((r) => ({
        threadId: r.id,
        title: r.title,
        authorEmail: r.author.email,
        boardName: r.board.title,
        repliesCount: r._count.replies,
        isSolved: r.isSolved,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
