"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AchievementSummary,
  ActivitySummary,
  AssignmentPerformanceSummary,
  CourseCompletionEntry,
  LearningProgressSummary,
  LearningTimelineEntry,
  QuizPerformanceSummary,
} from "@examora/types";

/** Typed wrappers over the caller's own analytics dashboard endpoints (ADR-0020). */
export function useAnalyticsApi() {
  const { request } = useAuth();

  return {
    getProgress: () =>
      request<LearningProgressSummary>("/analytics/me/progress", { method: "GET" }),
    getCourseCompletion: () =>
      request<CourseCompletionEntry[]>("/analytics/me/course-completion", { method: "GET" }),
    getQuizPerformance: () =>
      request<QuizPerformanceSummary>("/analytics/me/quiz-performance", { method: "GET" }),
    getAssignmentPerformance: () =>
      request<AssignmentPerformanceSummary>("/analytics/me/assignment-performance", {
        method: "GET",
      }),
    getTimeline: (limit = 20) =>
      request<LearningTimelineEntry[]>(`/analytics/me/timeline?limit=${limit}`, { method: "GET" }),
    getActivity: () => request<ActivitySummary>("/analytics/me/activity", { method: "GET" }),
    getAchievements: () =>
      request<AchievementSummary>("/analytics/me/achievements", { method: "GET" }),
  };
}
