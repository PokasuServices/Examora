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
} from "@examora/types";

/** Typed wrappers over the cross-platform admin analytics dashboards (analytics:admin, ADR-0020). */
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
