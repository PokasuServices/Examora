import { Injectable } from "@nestjs/common";
import type {
  MentorAssignmentReviewStats,
  MentorEngagementSummary,
  MentorPerformanceTrendPoint,
  MentorQuizPerformanceSummary,
  MentorStudentProgressEntry,
  MentorWorkloadSummary,
} from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import { MentorAssignmentService } from "../../mentoring/assignment/mentor-assignment.service";
import { MentorProfilesService } from "../../mentoring/mentor-profiles/mentor-profiles.service";
import { StudentAnalyticsService } from "../student/student-analytics.service";

const WEEKS_OF_TRENDS = 8;

function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday-start week
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

/**
 * A mentor's own analytics dashboard, scoped to their active students only
 * (analytics:mentor, ADR-0020 §3/§7). Reuses MentorAssignmentService/
 * MentorProfilesService (Sprint 6) for ownership scoping and workload, and
 * StudentAnalyticsService's per-course completion for the progress
 * dashboard, rather than duplicating that query per student.
 */
@Injectable()
export class MentorAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mentorAssignmentService: MentorAssignmentService,
    private readonly mentorProfilesService: MentorProfilesService,
    private readonly studentAnalyticsService: StudentAnalyticsService,
  ) {}

  private async myStudentIds(mentorId: string): Promise<string[]> {
    return this.mentorAssignmentService.listAssignedStudentIds(mentorId);
  }

  async getStudentProgressDashboard(mentorId: string): Promise<MentorStudentProgressEntry[]> {
    const studentIds = await this.myStudentIds(mentorId);
    if (studentIds.length === 0) return [];

    const students = await this.prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    return Promise.all(
      students.map(async (student) => {
        const [progress, quiz, assignment, lastActivity] = await Promise.all([
          this.studentAnalyticsService.getLearningProgress(student.id),
          this.studentAnalyticsService.getQuizPerformance(student.id),
          this.studentAnalyticsService.getAssignmentPerformance(student.id),
          this.prisma.lessonProgress.findFirst({
            where: { userId: student.id },
            orderBy: { lastViewedAt: "desc" },
            select: { lastViewedAt: true },
          }),
        ]);
        return {
          studentId: student.id,
          studentEmail: student.email,
          studentName:
            [student.firstName, student.lastName].filter(Boolean).join(" ").trim() || null,
          overallCompletionPercent: progress.overallCompletionPercent,
          quizAverage: quiz.averagePercentage,
          assignmentAverage: assignment.averageMarksPercent,
          lastActiveAt: lastActivity ? lastActivity.lastViewedAt.toISOString() : null,
        };
      }),
    );
  }

  async getPerformanceTrends(mentorId: string): Promise<MentorPerformanceTrendPoint[]> {
    const studentIds = await this.myStudentIds(mentorId);
    if (studentIds.length === 0) return [];

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - WEEKS_OF_TRENDS * 7);

    const [quizAttempts, reviews] = await Promise.all([
      this.prisma.quizAttempt.findMany({
        where: { userId: { in: studentIds }, submittedAt: { gte: since } },
        select: { submittedAt: true, percentage: true },
      }),
      this.prisma.assignmentReview.findMany({
        where: {
          submission: { studentId: { in: studentIds } },
          publishedAt: { gte: since },
          obtainedMarks: { not: null },
        },
        include: { submission: { include: { assignment: { select: { marksTotal: true } } } } },
      }),
    ]);

    const weeks = new Map<
      string,
      { quizSum: number; quizCount: number; assignSum: number; assignCount: number }
    >();
    for (let i = 0; i < WEEKS_OF_TRENDS; i++) {
      const weekStart = startOfWeek(new Date(since.getTime() + i * 7 * 24 * 60 * 60 * 1000));
      weeks.set(weekStart.toISOString().slice(0, 10), {
        quizSum: 0,
        quizCount: 0,
        assignSum: 0,
        assignCount: 0,
      });
    }

    for (const attempt of quizAttempts) {
      if (!attempt.submittedAt || attempt.percentage === null) continue;
      const key = startOfWeek(attempt.submittedAt).toISOString().slice(0, 10);
      const bucket = weeks.get(key);
      if (bucket) {
        bucket.quizSum += Number(attempt.percentage);
        bucket.quizCount += 1;
      }
    }
    for (const review of reviews) {
      if (!review.publishedAt || review.obtainedMarks === null) continue;
      const key = startOfWeek(review.publishedAt).toISOString().slice(0, 10);
      const bucket = weeks.get(key);
      const marksTotal = Number(review.submission.assignment.marksTotal ?? 0);
      if (bucket && marksTotal > 0) {
        bucket.assignSum += (Number(review.obtainedMarks) / marksTotal) * 100;
        bucket.assignCount += 1;
      }
    }

    return [...weeks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, bucket]) => ({
        weekStart,
        averageQuizPercentage:
          bucket.quizCount === 0
            ? null
            : Math.round((bucket.quizSum / bucket.quizCount) * 100) / 100,
        averageAssignmentPercentage:
          bucket.assignCount === 0
            ? null
            : Math.round((bucket.assignSum / bucket.assignCount) * 100) / 100,
      }));
  }

  async getQuizPerformance(mentorId: string): Promise<MentorQuizPerformanceSummary> {
    const studentIds = await this.myStudentIds(mentorId);
    if (studentIds.length === 0) {
      return { studentCount: 0, averagePercentage: null, passRate: null };
    }
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId: { in: studentIds }, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
      select: { percentage: true, passed: true },
    });
    const percentages = attempts
      .map((a) => (a.percentage === null ? null : Number(a.percentage)))
      .filter((p): p is number => p !== null);
    const passedCount = attempts.filter((a) => a.passed === true).length;

    return {
      studentCount: studentIds.length,
      averagePercentage:
        percentages.length === 0
          ? null
          : Math.round((percentages.reduce((s, p) => s + p, 0) / percentages.length) * 100) / 100,
      passRate:
        attempts.length === 0 ? null : Math.round((passedCount / attempts.length) * 10000) / 100,
    };
  }

  async getAssignmentReviewStats(mentorId: string): Promise<MentorAssignmentReviewStats> {
    const monthAgo = new Date();
    monthAgo.setUTCDate(monthAgo.getUTCDate() - 30);

    const [pendingReview, reviewedThisMonth] = await Promise.all([
      this.prisma.assignmentSubmission.count({
        where: { reviewerId: mentorId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      }),
      this.prisma.assignmentReview.findMany({
        where: { reviewerId: mentorId, publishedAt: { gte: monthAgo } },
        include: { submission: { select: { submittedAt: true } } },
      }),
    ]);

    const turnarounds = reviewedThisMonth
      .filter((r) => r.submission.submittedAt && r.publishedAt)
      .map(
        (r) => (r.publishedAt!.getTime() - r.submission.submittedAt!.getTime()) / (1000 * 60 * 60),
      );

    return {
      pendingReview,
      reviewedThisMonth: reviewedThisMonth.length,
      averageTurnaroundHours:
        turnarounds.length === 0
          ? null
          : Math.round((turnarounds.reduce((s, h) => s + h, 0) / turnarounds.length) * 100) / 100,
    };
  }

  async getWorkload(mentorId: string): Promise<MentorWorkloadSummary> {
    const [profile, activeStudentCount, studentIds] = await Promise.all([
      this.mentorProfilesService.findByUserIdOrThrow(mentorId),
      this.mentorAssignmentService.getWorkload(mentorId),
      this.myStudentIds(mentorId),
    ]);

    const [pendingTasksCount, upcomingMeetingsCount] = await Promise.all([
      this.prisma.mentorTask.count({
        where: { studentId: { in: studentIds }, status: { in: ["PENDING", "IN_PROGRESS"] } },
      }),
      this.prisma.mentorMeeting.count({
        where: { studentId: { in: studentIds }, occurredAt: { gte: new Date() } },
      }),
    ]);

    return {
      activeStudentCount,
      maxStudents: profile.maxStudents,
      utilizationPercent:
        profile.maxStudents === 0
          ? 0
          : Math.round((activeStudentCount / profile.maxStudents) * 10000) / 100,
      pendingTasksCount,
      upcomingMeetingsCount,
    };
  }

  async getEngagementSummary(mentorId: string): Promise<MentorEngagementSummary> {
    const studentIds = await this.myStudentIds(mentorId);
    if (studentIds.length === 0) {
      return { studentsActiveLast7Days: 0, studentsInactive14Days: 0, totalStudents: 0 };
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);

    const [activeRows, recentlyActiveIds] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { userId: { in: studentIds }, lastViewedAt: { gte: sevenDaysAgo } },
        distinct: ["userId"],
        select: { userId: true },
      }),
      this.prisma.lessonProgress.findMany({
        where: { userId: { in: studentIds }, lastViewedAt: { gte: fourteenDaysAgo } },
        distinct: ["userId"],
        select: { userId: true },
      }),
    ]);

    const recentlyActiveSet = new Set(recentlyActiveIds.map((r) => r.userId));

    return {
      studentsActiveLast7Days: activeRows.length,
      studentsInactive14Days: studentIds.filter((id) => !recentlyActiveSet.has(id)).length,
      totalStudents: studentIds.length,
    };
  }
}
