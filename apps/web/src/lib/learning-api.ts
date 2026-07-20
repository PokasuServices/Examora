"use client";

import { useAuth } from "@examora/auth-client";
import type {
  Course,
  CourseProgress,
  Curriculum,
  LearningDashboard,
  LessonWithProgress,
  PaginatedData,
} from "@examora/types";

/** Typed wrappers over the student-facing catalog + learning endpoints. */
export function useLearningApi() {
  const { request } = useAuth();

  return {
    listCourses: () =>
      request<PaginatedData<Course>>("/catalog/courses?pageSize=100", { method: "GET" }),
    getCourse: (id: string) => request<Course>(`/catalog/courses/${id}`, { method: "GET" }),
    getCurriculum: (id: string) =>
      request<Curriculum>(`/catalog/courses/${id}/curriculum`, { method: "GET" }),
    getLesson: (id: string) =>
      request<LessonWithProgress>(`/catalog/lessons/${id}`, { method: "GET" }),

    recordView: (lessonId: string) =>
      request<void>(`/learning/lessons/${lessonId}/view`, { method: "POST" }),
    completeLesson: (lessonId: string) =>
      request<{ status: string }>(`/learning/lessons/${lessonId}/complete`, { method: "POST" }),
    getCourseProgress: (courseId: string) =>
      request<CourseProgress>(`/learning/courses/${courseId}/progress`, { method: "GET" }),
    getDashboard: () => request<LearningDashboard>("/learning/dashboard", { method: "GET" }),
  };
}
