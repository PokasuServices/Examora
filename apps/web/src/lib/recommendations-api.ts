"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AssignmentRecommendation,
  ContinueLearningItem,
  CourseRecommendation,
  LearningPathStep,
  QuizRecommendation,
  RelatedDiscussionRecommendation,
  SimilarCourseRecommendation,
} from "@examora/types";

/** Typed wrappers over the caller's own recommendation endpoints (ADR-0021). */
export function useRecommendationsApi() {
  const { request } = useAuth();

  return {
    getContinueLearning: () =>
      request<ContinueLearningItem[]>("/recommendations/me/continue-learning", { method: "GET" }),
    getRecommendedCourses: () =>
      request<CourseRecommendation[]>("/recommendations/me/courses", { method: "GET" }),
    getSimilarCourses: (courseId?: string) =>
      request<SimilarCourseRecommendation[]>(
        `/recommendations/me/similar-courses${courseId ? `?courseId=${courseId}` : ""}`,
        { method: "GET" },
      ),
    getLearningPath: () =>
      request<LearningPathStep[]>("/recommendations/me/learning-path", { method: "GET" }),
    getRecommendedQuizzes: () =>
      request<QuizRecommendation[]>("/recommendations/me/quizzes", { method: "GET" }),
    getRecommendedAssignments: () =>
      request<AssignmentRecommendation[]>("/recommendations/me/assignments", { method: "GET" }),
    getRelatedDiscussions: () =>
      request<RelatedDiscussionRecommendation[]>("/recommendations/me/community-discussions", {
        method: "GET",
      }),
  };
}
