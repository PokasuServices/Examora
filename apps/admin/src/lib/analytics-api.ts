"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AdminAssignmentAnalytics,
  AdminCommunityAnalytics,
  AdminCoursePerformanceEntry,
  AdminEnrollmentAnalytics,
  AdminMentorPerformanceEntry,
  AdminNotificationDeliveryAnalytics,
  AdminPlatformDashboard,
  AdminQuizAnalytics,
  AdminRevenueAnalytics,
  AdminUserGrowthAnalytics,
  MentorAssignmentReviewStats,
  MentorEngagementSummary,
  MentorPerformanceTrendPoint,
  MentorQuizPerformanceSummary,
  MentorStudentProgressEntry,
  MentorWorkloadSummary,
  ReportFormat,
  ReportResult,
  ReportType,
  ScheduledReportDto,
} from "@examora/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "http://localhost:3001/api/v1";

/** Typed wrappers over the mentor analytics dashboard endpoints (analytics:mentor, ADR-0020). */
export function useMentorAnalyticsApi() {
  const { request } = useAuth();

  return {
    getStudentProgress: () =>
      request<MentorStudentProgressEntry[]>("/analytics/mentor/student-progress", {
        method: "GET",
      }),
    getPerformanceTrends: () =>
      request<MentorPerformanceTrendPoint[]>("/analytics/mentor/performance-trends", {
        method: "GET",
      }),
    getQuizPerformance: () =>
      request<MentorQuizPerformanceSummary>("/analytics/mentor/quiz-performance", {
        method: "GET",
      }),
    getAssignmentReviewStats: () =>
      request<MentorAssignmentReviewStats>("/analytics/mentor/assignment-review-stats", {
        method: "GET",
      }),
    getWorkload: () =>
      request<MentorWorkloadSummary>("/analytics/mentor/workload", { method: "GET" }),
    getEngagement: () =>
      request<MentorEngagementSummary>("/analytics/mentor/engagement", { method: "GET" }),
  };
}

/** Typed wrappers over the platform-wide admin analytics endpoints (analytics:admin, ADR-0020). */
export function useAdminAnalyticsApi() {
  const { request } = useAuth();

  return {
    getPlatformDashboard: () =>
      request<AdminPlatformDashboard>("/admin/analytics/platform", { method: "GET" }),
    getUserGrowth: (days = 30) =>
      request<AdminUserGrowthAnalytics>(`/admin/analytics/user-growth?days=${days}`, {
        method: "GET",
      }),
    getEnrollmentAnalytics: (days = 30) =>
      request<AdminEnrollmentAnalytics>(`/admin/analytics/enrollment?days=${days}`, {
        method: "GET",
      }),
    getRevenueAnalytics: (days = 30) =>
      request<AdminRevenueAnalytics>(`/admin/analytics/revenue?days=${days}`, { method: "GET" }),
    getCoursePerformance: () =>
      request<AdminCoursePerformanceEntry[]>("/admin/analytics/course-performance", {
        method: "GET",
      }),
    getMentorPerformance: () =>
      request<AdminMentorPerformanceEntry[]>("/admin/analytics/mentor-performance", {
        method: "GET",
      }),
    getAssignmentAnalytics: () =>
      request<AdminAssignmentAnalytics>("/admin/analytics/assignments", { method: "GET" }),
    getQuizAnalytics: () =>
      request<AdminQuizAnalytics>("/admin/analytics/quizzes", { method: "GET" }),
    getCommunityAnalytics: (days = 30) =>
      request<AdminCommunityAnalytics>(`/admin/analytics/community?days=${days}`, {
        method: "GET",
      }),
    getNotificationDeliveryAnalytics: () =>
      request<AdminNotificationDeliveryAnalytics>("/admin/analytics/notification-delivery", {
        method: "GET",
      }),
  };
}

export interface CreateScheduledReportInput {
  name: string;
  reportType: ReportType;
  format: ReportFormat;
  cadence: "DAILY" | "WEEKLY" | "MONTHLY";
}

/** Typed wrappers over the Report Builder, export, and scheduled-reports endpoints (analytics:admin, ADR-0020). */
export function useReportsApi() {
  const { request, accessToken } = useAuth();

  return {
    run: (reportType: ReportType, params?: { from?: string; to?: string; limit?: number }) => {
      const query = new URLSearchParams({ reportType });
      if (params?.from) query.set("from", params.from);
      if (params?.to) query.set("to", params.to);
      if (params?.limit) query.set("limit", String(params.limit));
      return request<ReportResult>(`/admin/reports/run?${query.toString()}`, { method: "GET" });
    },

    /** Downloads the export as a file — bypasses the JSON envelope, so it uses a raw fetch. */
    download: async (
      reportType: ReportType,
      format: ReportFormat,
      params?: { from?: string; to?: string; limit?: number },
    ): Promise<void> => {
      const query = new URLSearchParams({ reportType, format });
      if (params?.from) query.set("from", params.from);
      if (params?.to) query.set("to", params.to);
      if (params?.limit) query.set("limit", String(params.limit));

      const response = await fetch(`${API_BASE_URL}/admin/reports/export?${query.toString()}`, {
        credentials: "include",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `${reportType.toLowerCase()}.${format.toLowerCase()}`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },

    listScheduled: () =>
      request<ScheduledReportDto[]>("/admin/reports/scheduled", { method: "GET" }),
    createScheduled: (input: CreateScheduledReportInput) =>
      request<ScheduledReportDto>("/admin/reports/scheduled", { method: "POST", body: input }),
    setScheduledActive: (id: string, isActive: boolean) =>
      request<ScheduledReportDto>(`/admin/reports/scheduled/${id}/active`, {
        method: "PATCH",
        body: { isActive },
      }),
    runScheduledNow: (id: string) =>
      request<{ success: boolean }>(`/admin/reports/scheduled/${id}/run-now`, { method: "POST" }),
    deleteScheduled: (id: string) =>
      request<void>(`/admin/reports/scheduled/${id}`, { method: "DELETE" }),
  };
}
