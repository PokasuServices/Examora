import type { ReportType } from "@examora/types";

/** Only ENROLLMENT/REVENUE/COMMUNITY_ACTIVITY actually apply the from/to date range server-side (ReportBuilderService.dateRange) — the rest ignore it, so the UI says so rather than implying a filter that silently does nothing. */
export const DATE_FILTERED_REPORT_TYPES: ReportType[] = [
  "ENROLLMENT",
  "REVENUE",
  "COMMUNITY_ACTIVITY",
];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  STUDENT_PROGRESS: "Student Progress",
  COURSE_COMPLETION: "Course Completion",
  QUIZ_PERFORMANCE: "Quiz Performance",
  ASSIGNMENT_PERFORMANCE: "Assignment Performance",
  ENROLLMENT: "Enrollment",
  REVENUE: "Revenue",
  COURSE_PERFORMANCE: "Course Performance",
  MENTOR_PERFORMANCE: "Mentor Performance",
  COMMUNITY_ACTIVITY: "Community Activity",
  NOTIFICATION_DELIVERY: "Notification Delivery",
};
