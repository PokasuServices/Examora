/**
 * Analytics & Reporting DTOs (Sprint 10, ADR-0020). Every shape here is a
 * read-only aggregation over existing domain tables — no new business
 * concepts, matching ADR-0020 §2.
 */

// ---------------------------------------------------------------------------
// Student analytics (own data only — analytics:read:own)
// ---------------------------------------------------------------------------

export interface LearningProgressSummary {
  enrolledCourseCount: number;
  inProgressCourseCount: number;
  completedCourseCount: number;
  totalLessonsCompleted: number;
  overallCompletionPercent: number;
}

export interface CourseCompletionEntry {
  courseId: string;
  courseTitle: string;
  totalLessons: number;
  completedLessons: number;
  completionPercent: number;
  enrolledAt: string;
}

export interface QuizPerformanceSummary {
  attemptsSubmitted: number;
  averagePercentage: number | null;
  bestPercentage: number | null;
  passRate: number | null;
  recentAttempts: Array<{
    attemptId: string;
    quizTitle: string;
    percentage: number | null;
    passed: boolean | null;
    submittedAt: string | null;
  }>;
}

export interface AssignmentPerformanceSummary {
  submittedCount: number;
  reviewedCount: number;
  averageMarksPercent: number | null;
  recentReviews: Array<{
    submissionId: string;
    assignmentTitle: string;
    decision: string | null;
    obtainedMarks: number | null;
    marksTotal: number;
    publishedAt: string | null;
  }>;
}

export type LearningTimelineEventType =
  | "LESSON_COMPLETED"
  | "QUIZ_SUBMITTED"
  | "ASSIGNMENT_SUBMITTED"
  | "ASSIGNMENT_REVIEWED"
  | "COURSE_ENROLLED";

export interface LearningTimelineEntry {
  type: LearningTimelineEventType;
  title: string;
  occurredAt: string;
}

export interface ActivitySummary {
  last7DaysActiveDays: number;
  last30DaysActiveDays: number;
  lastActiveAt: string | null;
  currentStreakDays: number;
}

export interface AchievementSummary {
  coursesCompleted: number;
  quizzesPassed: number;
  assignmentsApproved: number;
  reputationPoints: number;
  communityAcceptedAnswers: number;
}

// ---------------------------------------------------------------------------
// Mentor analytics (own assigned students only — analytics:mentor)
// ---------------------------------------------------------------------------

export interface MentorStudentProgressEntry {
  studentId: string;
  studentEmail: string;
  studentName: string | null;
  overallCompletionPercent: number;
  quizAverage: number | null;
  assignmentAverage: number | null;
  lastActiveAt: string | null;
}

export interface MentorPerformanceTrendPoint {
  weekStart: string;
  averageQuizPercentage: number | null;
  averageAssignmentPercentage: number | null;
}

export interface MentorQuizPerformanceSummary {
  studentCount: number;
  averagePercentage: number | null;
  passRate: number | null;
}

export interface MentorAssignmentReviewStats {
  pendingReview: number;
  reviewedThisMonth: number;
  averageTurnaroundHours: number | null;
}

export interface MentorWorkloadSummary {
  activeStudentCount: number;
  maxStudents: number;
  utilizationPercent: number;
  pendingTasksCount: number;
  upcomingMeetingsCount: number;
}

export interface MentorEngagementSummary {
  studentsActiveLast7Days: number;
  studentsInactive14Days: number;
  totalStudents: number;
}

// ---------------------------------------------------------------------------
// Admin analytics (platform-wide — analytics:admin)
// ---------------------------------------------------------------------------

export interface AdminPlatformDashboard {
  totalUsers: number;
  totalStudents: number;
  totalMentors: number;
  totalCourses: number;
  publishedCourseCount: number;
  totalEnrollments: number;
  activeEnrollments: number;
  totalRevenue: number;
  revenueCurrency: string;
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface AdminUserGrowthAnalytics {
  newUsersByDay: TimeSeriesPoint[];
  totalUsers: number;
  usersByRole: Array<{ role: string; count: number }>;
}

export interface AdminEnrollmentAnalytics {
  totalEnrollments: number;
  activeEnrollments: number;
  expiredEnrollments: number;
  revokedEnrollments: number;
  enrollmentsBySource: Array<{ source: string; count: number }>;
  enrollmentsByDay: TimeSeriesPoint[];
}

export interface AdminRevenueAnalytics {
  totalRevenue: number;
  currency: string;
  revenueByDay: Array<{ date: string; amount: number }>;
  ordersPaid: number;
  averageOrderValue: number;
  totalRefunded: number;
  couponRedemptions: number;
}

export interface AdminCoursePerformanceEntry {
  courseId: string;
  courseTitle: string;
  enrollmentCount: number;
  averageCompletionPercent: number;
  averageQuizPercentage: number | null;
  revenue: number;
}

export interface AdminMentorPerformanceEntry {
  mentorId: string;
  mentorEmail: string;
  activeStudentCount: number;
  averageStudentCompletionPercent: number;
  pendingReviewCount: number;
  averageReviewTurnaroundHours: number | null;
}

export interface AdminCommunityAnalytics {
  totalThreads: number;
  totalReplies: number;
  threadsByDay: TimeSeriesPoint[];
  acceptedAnswerRate: number | null;
  moderationActionsCount: number;
  openReportsCount: number;
}

export interface AdminNotificationDeliveryAnalytics {
  totalNotifications: number;
  deliveryByChannel: Array<{
    channel: string;
    queued: number;
    delivered: number;
    failed: number;
    suppressed: number;
    successRate: number | null;
  }>;
  overallSuccessRate: number | null;
}

export interface AdminAssignmentAnalytics {
  totalAssignments: number;
  totalSubmissions: number;
  reviewedCount: number;
  pendingReviewCount: number;
  averageMarksPercent: number | null;
  decisionBreakdown: Array<{ decision: string; count: number }>;
}

export interface AdminQuizAnalytics {
  totalQuizzes: number;
  totalAttempts: number;
  submittedAttempts: number;
  averagePercentage: number | null;
  passRate: number | null;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export const REPORT_TYPES = [
  "STUDENT_PROGRESS",
  "COURSE_COMPLETION",
  "QUIZ_PERFORMANCE",
  "ASSIGNMENT_PERFORMANCE",
  "ENROLLMENT",
  "REVENUE",
  "COURSE_PERFORMANCE",
  "MENTOR_PERFORMANCE",
  "COMMUNITY_ACTIVITY",
  "NOTIFICATION_DELIVERY",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_CADENCES = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type ReportCadence = (typeof REPORT_CADENCES)[number];

export const REPORT_FORMATS = ["CSV", "PDF"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export interface ReportRow {
  [column: string]: string | number | boolean | null;
}

export interface ReportResult {
  reportType: ReportType;
  generatedAt: string;
  columns: string[];
  rows: ReportRow[];
}

export interface ScheduledReportDto {
  id: string;
  name: string;
  reportType: ReportType;
  format: ReportFormat;
  cadence: ReportCadence;
  filters: Record<string, unknown> | null;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}
