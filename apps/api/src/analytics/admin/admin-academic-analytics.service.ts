import { Injectable } from "@nestjs/common";
import type {
  AdminAssignmentAnalytics,
  AdminCoursePerformanceEntry,
  AdminMentorPerformanceEntry,
  AdminQuizAnalytics,
} from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import { StudentAnalyticsService } from "../student/student-analytics.service";

const PUBLISHED = { status: "PUBLISHED" as const, deletedAt: null };

/**
 * Academic-content analytics: course/mentor performance, assignments, quizzes
 * (analytics:admin, ADR-0020 §7). Per-course/per-mentor loops below are
 * bounded by course/mentor counts (not student counts), mirroring the
 * `Promise.all(courseIds.map(...))` pattern ProgressService already uses.
 * Mentor performance reuses StudentAnalyticsService.getLearningProgress() per
 * assigned student rather than approximating completion from raw lesson counts.
 */
@Injectable()
export class AdminAcademicAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentAnalyticsService: StudentAnalyticsService,
  ) {}

  async getCoursePerformance(): Promise<AdminCoursePerformanceEntry[]> {
    const courses = await this.prisma.course.findMany({
      where: PUBLISHED,
      select: { id: true, title: true },
    });

    return Promise.all(
      courses.map(async (course) => {
        const [enrollmentCount, totalLessons, completions, quizAgg, revenueAgg] = await Promise.all(
          [
            this.prisma.enrollment.count({ where: { courseId: course.id, status: "ACTIVE" } }),
            this.prisma.lesson.count({
              where: {
                ...PUBLISHED,
                module: {
                  ...PUBLISHED,
                  topic: { ...PUBLISHED, subject: { ...PUBLISHED, courseId: course.id } },
                },
              },
            }),
            this.prisma.lessonProgress.count({
              where: { courseId: course.id, completedAt: { not: null } },
            }),
            this.prisma.quizAttempt.aggregate({
              where: {
                quiz: { subject: { courseId: course.id } },
                percentage: { not: null },
              },
              _avg: { percentage: true },
            }),
            this.prisma.order.aggregate({
              where: { courseId: course.id, status: "PAID" },
              _sum: { totalAmount: true },
            }),
          ],
        );

        const averageCompletionPercent =
          enrollmentCount === 0 || totalLessons === 0
            ? 0
            : Math.round((completions / (enrollmentCount * totalLessons)) * 10000) / 100;

        return {
          courseId: course.id,
          courseTitle: course.title,
          enrollmentCount,
          averageCompletionPercent,
          averageQuizPercentage:
            quizAgg._avg.percentage === null ? null : Number(quizAgg._avg.percentage),
          revenue: Number(revenueAgg._sum.totalAmount ?? 0),
        };
      }),
    );
  }

  async getMentorPerformance(): Promise<AdminMentorPerformanceEntry[]> {
    const mentors = await this.prisma.user.findMany({
      where: { roles: { some: { role: { name: "MENTOR" } } } },
      select: { id: true, email: true },
    });

    return Promise.all(
      mentors.map(async (mentor) => {
        const [activeStudentCount, studentIds, pendingReviewCount, recentReviews] =
          await Promise.all([
            this.prisma.mentorAssignment.count({
              where: { mentorId: mentor.id, unassignedAt: null },
            }),
            this.prisma.mentorAssignment
              .findMany({
                where: { mentorId: mentor.id, unassignedAt: null },
                select: { studentId: true },
              })
              .then((rows) => rows.map((r) => r.studentId)),
            this.prisma.assignmentSubmission.count({
              where: { reviewerId: mentor.id, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
            }),
            this.prisma.assignmentReview.findMany({
              where: { reviewerId: mentor.id, publishedAt: { not: null } },
              include: { submission: { select: { submittedAt: true } } },
              take: 50,
              orderBy: { publishedAt: "desc" },
            }),
          ]);

        const studentProgress =
          studentIds.length === 0
            ? []
            : await Promise.all(
                studentIds.map((id) => this.studentAnalyticsService.getLearningProgress(id)),
              );
        const averageStudentCompletionPercent =
          studentProgress.length === 0
            ? 0
            : Math.round(
                studentProgress.reduce((sum, p) => sum + p.overallCompletionPercent, 0) /
                  studentProgress.length,
              );

        const turnarounds = recentReviews
          .filter((r) => r.submission.submittedAt && r.publishedAt)
          .map(
            (r) =>
              (r.publishedAt!.getTime() - r.submission.submittedAt!.getTime()) / (1000 * 60 * 60),
          );

        return {
          mentorId: mentor.id,
          mentorEmail: mentor.email,
          activeStudentCount,
          averageStudentCompletionPercent,
          pendingReviewCount,
          averageReviewTurnaroundHours:
            turnarounds.length === 0
              ? null
              : Math.round((turnarounds.reduce((s, h) => s + h, 0) / turnarounds.length) * 100) /
                100,
        };
      }),
    );
  }

  async getAssignmentAnalytics(): Promise<AdminAssignmentAnalytics> {
    const [totalAssignments, totalSubmissions, reviewed, pending, marksAgg, decisions] =
      await Promise.all([
        this.prisma.assignment.count({ where: { deletedAt: null } }),
        this.prisma.assignmentSubmission.count({ where: { status: { not: "DRAFT" } } }),
        this.prisma.assignmentReview.count({ where: { publishedAt: { not: null } } }),
        this.prisma.assignmentSubmission.count({
          where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
        }),
        this.prisma.assignmentReview.findMany({
          where: { obtainedMarks: { not: null } },
          include: { submission: { include: { assignment: { select: { marksTotal: true } } } } },
        }),
        this.prisma.assignmentReview.groupBy({
          by: ["decision"],
          where: { decision: { not: null } },
          _count: true,
        }),
      ]);

    const percentages = marksAgg
      .filter((r) => Number(r.submission.assignment.marksTotal) > 0)
      .map((r) => (Number(r.obtainedMarks) / Number(r.submission.assignment.marksTotal)) * 100);

    return {
      totalAssignments,
      totalSubmissions,
      reviewedCount: reviewed,
      pendingReviewCount: pending,
      averageMarksPercent:
        percentages.length === 0
          ? null
          : Math.round((percentages.reduce((s, p) => s + p, 0) / percentages.length) * 100) / 100,
      decisionBreakdown: decisions.map((d) => ({
        decision: d.decision as string,
        count: d._count,
      })),
    };
  }

  async getQuizAnalytics(): Promise<AdminQuizAnalytics> {
    const [totalQuizzes, totalAttempts, submitted, agg, passed] = await Promise.all([
      this.prisma.quiz.count({ where: { deletedAt: null } }),
      this.prisma.quizAttempt.count(),
      this.prisma.quizAttempt.count({ where: { status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } } }),
      this.prisma.quizAttempt.aggregate({
        where: { percentage: { not: null } },
        _avg: { percentage: true },
      }),
      this.prisma.quizAttempt.count({ where: { passed: true } }),
    ]);

    return {
      totalQuizzes,
      totalAttempts,
      submittedAttempts: submitted,
      averagePercentage: agg._avg.percentage === null ? null : Number(agg._avg.percentage),
      passRate: submitted === 0 ? null : Math.round((passed / submitted) * 10000) / 100,
    };
  }
}
