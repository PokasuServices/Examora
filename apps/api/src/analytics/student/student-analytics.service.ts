import { Injectable } from "@nestjs/common";
import type {
  AchievementSummary,
  ActivitySummary,
  AssignmentPerformanceSummary,
  CourseCompletionEntry,
  LearningProgressSummary,
  LearningTimelineEntry,
  QuizPerformanceSummary,
} from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import { ProgressService } from "../../learning/progress.service";
import { SubmissionsService } from "../../assignments/submissions/submissions.service";

/**
 * A student's own analytics (analytics:read:own, ADR-0020 §7). Reuses
 * ProgressService (Sprint 3) for per-course completion and SubmissionsService
 * (Sprint 5) for assignment history — only quiz-attempt aggregation and the
 * cross-domain timeline/activity/achievement views are new queries, since no
 * existing service exposes an un-paginated "all my attempts" read.
 */
@Injectable()
export class StudentAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: ProgressService,
    private readonly submissionsService: SubmissionsService,
  ) {}

  private async enrolledCourseIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: { userId, status: "ACTIVE" },
      select: { courseId: true },
    });
    return rows.map((r) => r.courseId);
  }

  async getCourseCompletion(userId: string): Promise<CourseCompletionEntry[]> {
    const [courseIds, enrollments] = await Promise.all([
      this.enrolledCourseIds(userId),
      this.prisma.enrollment.findMany({
        where: { userId, status: "ACTIVE" },
        select: { courseId: true, enrolledAt: true },
      }),
    ]);
    const enrolledAtByCourse = new Map(enrollments.map((e) => [e.courseId, e.enrolledAt]));

    const summaries = await Promise.all(
      courseIds.map((courseId) => this.progressService.getCourseProgress(userId, courseId)),
    );

    return summaries.map((s) => ({
      courseId: s.courseId,
      courseTitle: s.courseTitle,
      totalLessons: s.totalLessons,
      completedLessons: s.completedLessons,
      completionPercent: s.percentComplete,
      enrolledAt: (enrolledAtByCourse.get(s.courseId) ?? new Date()).toISOString(),
    }));
  }

  async getLearningProgress(userId: string): Promise<LearningProgressSummary> {
    const entries = await this.getCourseCompletion(userId);
    const completed = entries.filter((e) => e.totalLessons > 0 && e.completionPercent === 100);
    const inProgress = entries.filter((e) => e.completionPercent > 0 && e.completionPercent < 100);
    const totalLessonsCompleted = entries.reduce((sum, e) => sum + e.completedLessons, 0);
    const overallCompletionPercent =
      entries.length === 0
        ? 0
        : Math.round(entries.reduce((sum, e) => sum + e.completionPercent, 0) / entries.length);

    return {
      enrolledCourseCount: entries.length,
      inProgressCourseCount: inProgress.length,
      completedCourseCount: completed.length,
      totalLessonsCompleted,
      overallCompletionPercent,
    };
  }

  async getQuizPerformance(userId: string): Promise<QuizPerformanceSummary> {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
      include: { quiz: { select: { title: true } } },
      orderBy: { submittedAt: "desc" },
    });

    const percentages = attempts
      .map((a) => (a.percentage === null ? null : Number(a.percentage)))
      .filter((p): p is number => p !== null);
    const passedCount = attempts.filter((a) => a.passed === true).length;

    return {
      attemptsSubmitted: attempts.length,
      averagePercentage:
        percentages.length === 0
          ? null
          : Math.round((percentages.reduce((s, p) => s + p, 0) / percentages.length) * 100) / 100,
      bestPercentage: percentages.length === 0 ? null : Math.max(...percentages),
      passRate:
        attempts.length === 0 ? null : Math.round((passedCount / attempts.length) * 10000) / 100,
      recentAttempts: attempts.slice(0, 5).map((a) => ({
        attemptId: a.id,
        quizTitle: a.quiz.title,
        percentage: a.percentage === null ? null : Number(a.percentage),
        passed: a.passed,
        submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
      })),
    };
  }

  async getAssignmentPerformance(userId: string): Promise<AssignmentPerformanceSummary> {
    const submissions = await this.submissionsService.listHistory(userId);
    const reviewed = submissions.filter((s) => s.review !== null);
    const percentages = reviewed
      .filter((s) => s.review!.obtainedMarks !== null)
      .map((s) => (Number(s.review!.obtainedMarks) / Number(s.assignment.marksTotal ?? 1)) * 100);

    return {
      submittedCount: submissions.filter((s) => s.status !== "DRAFT").length,
      reviewedCount: reviewed.length,
      averageMarksPercent:
        percentages.length === 0
          ? null
          : Math.round((percentages.reduce((s, p) => s + p, 0) / percentages.length) * 100) / 100,
      recentReviews: reviewed.slice(0, 5).map((s) => ({
        submissionId: s.id,
        assignmentTitle: s.assignment.title,
        decision: s.review?.decision ?? null,
        obtainedMarks: s.review?.obtainedMarks === null ? null : Number(s.review?.obtainedMarks),
        marksTotal: Number(s.assignment.marksTotal ?? 0),
        publishedAt: null,
      })),
    };
  }

  async getTimeline(userId: string, limit = 20): Promise<LearningTimelineEntry[]> {
    const [lessonCompletions, quizSubmissions, submissions, reviews, enrollments] =
      await Promise.all([
        this.prisma.lessonProgress.findMany({
          where: { userId, completedAt: { not: null } },
          include: { lesson: { select: { title: true } } },
          orderBy: { completedAt: "desc" },
          take: limit,
        }),
        this.prisma.quizAttempt.findMany({
          where: { userId, submittedAt: { not: null } },
          include: { quiz: { select: { title: true } } },
          orderBy: { submittedAt: "desc" },
          take: limit,
        }),
        this.prisma.assignmentSubmission.findMany({
          where: { studentId: userId, submittedAt: { not: null } },
          include: { assignment: { select: { title: true } } },
          orderBy: { submittedAt: "desc" },
          take: limit,
        }),
        this.prisma.assignmentReview.findMany({
          where: { submission: { studentId: userId }, publishedAt: { not: null } },
          include: { submission: { include: { assignment: { select: { title: true } } } } },
          orderBy: { publishedAt: "desc" },
          take: limit,
        }),
        this.prisma.enrollment.findMany({
          where: { userId },
          include: { course: { select: { title: true } } },
          orderBy: { enrolledAt: "desc" },
          take: limit,
        }),
      ]);

    const entries: LearningTimelineEntry[] = [
      ...lessonCompletions.map((l) => ({
        type: "LESSON_COMPLETED" as const,
        title: l.lesson.title,
        occurredAt: l.completedAt!.toISOString(),
      })),
      ...quizSubmissions.map((q) => ({
        type: "QUIZ_SUBMITTED" as const,
        title: q.quiz.title,
        occurredAt: q.submittedAt!.toISOString(),
      })),
      ...submissions.map((s) => ({
        type: "ASSIGNMENT_SUBMITTED" as const,
        title: s.assignment.title,
        occurredAt: s.submittedAt!.toISOString(),
      })),
      ...reviews.map((r) => ({
        type: "ASSIGNMENT_REVIEWED" as const,
        title: r.submission.assignment.title,
        occurredAt: r.publishedAt!.toISOString(),
      })),
      ...enrollments.map((e) => ({
        type: "COURSE_ENROLLED" as const,
        title: e.course.title,
        occurredAt: e.enrolledAt.toISOString(),
      })),
    ];

    return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit);
  }

  async getActivitySummary(userId: string): Promise<ActivitySummary> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [recentViews, monthViews, lastView] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { userId, lastViewedAt: { gte: sevenDaysAgo } },
        select: { lastViewedAt: true },
      }),
      this.prisma.lessonProgress.findMany({
        where: { userId, lastViewedAt: { gte: thirtyDaysAgo } },
        select: { lastViewedAt: true },
      }),
      this.prisma.lessonProgress.findFirst({
        where: { userId },
        orderBy: { lastViewedAt: "desc" },
        select: { lastViewedAt: true },
      }),
    ]);

    const activeDayKey = (d: Date): string => d.toISOString().slice(0, 10);
    const last7DaysActiveDays = new Set(recentViews.map((v) => activeDayKey(v.lastViewedAt))).size;
    const last30DaysActiveDays = new Set(monthViews.map((v) => activeDayKey(v.lastViewedAt))).size;

    // Consecutive days (from today backward) with at least one recorded view.
    const activeDaySet = new Set(monthViews.map((v) => activeDayKey(v.lastViewedAt)));
    let currentStreakDays = 0;
    for (let i = 0; i < 30; i++) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      if (activeDaySet.has(activeDayKey(day))) {
        currentStreakDays++;
      } else {
        break;
      }
    }

    return {
      last7DaysActiveDays,
      last30DaysActiveDays,
      lastActiveAt: lastView ? lastView.lastViewedAt.toISOString() : null,
      currentStreakDays,
    };
  }

  async getAchievementSummary(userId: string): Promise<AchievementSummary> {
    const [progress, quizPassed, assignmentsApproved, communityProfile, acceptedAnswers] =
      await Promise.all([
        this.getLearningProgress(userId),
        this.prisma.quizAttempt.count({ where: { userId, passed: true } }),
        this.prisma.assignmentSubmission.count({
          where: { studentId: userId, review: { decision: "APPROVED" } },
        }),
        this.prisma.communityProfile.findUnique({
          where: { userId },
          select: { reputationPoints: true },
        }),
        this.prisma.reply.count({ where: { authorId: userId, isAcceptedAnswer: true } }),
      ]);

    return {
      coursesCompleted: progress.completedCourseCount,
      quizzesPassed: quizPassed,
      assignmentsApproved,
      reputationPoints: communityProfile?.reputationPoints ?? 0,
      communityAcceptedAnswers: acceptedAnswers,
    };
  }
}
