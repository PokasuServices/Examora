"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AdminCollege,
  AdminWebinar,
  CohortView,
  CollegeEnquiryView,
  QuestionReportView,
  SketchCommentView,
  SketchReviewQueueItem,
  Topic,
} from "@examora/types";

export interface PracticeCategoryRow {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  position: number;
  quizCount: number;
}

export interface CheckpointRow {
  id: string;
  title: string;
  dueDate: string | null;
  completedBy: number;
}

export interface CollegeInput {
  name: string;
  city: string;
  categories: string[];
  logoUrl?: string | null;
  applicationFee?: number | null;
  website?: string | null;
  description?: string | null;
  published?: boolean;
  position?: number;
}

export interface WebinarInput {
  title: string;
  collegeId?: string | null;
  description?: string | null;
  bannerUrl?: string | null;
  startsAt: string;
  endsAt: string;
  joinUrl?: string | null;
  published?: boolean;
}

/** Admin endpoints added by the student module redesign. */
export function useStudentAdminApi() {
  const { request } = useAuth();
  const get = <T>(path: string) => request<T>(path, { method: "GET" });

  return {
    // Practice categories & checkpoints (per course)
    categories: (courseId: string) =>
      get<PracticeCategoryRow[]>(`/admin/practice/courses/${courseId}/categories`),
    createCategory: (courseId: string, body: { title: string; description?: string }) =>
      request(`/admin/practice/courses/${courseId}/categories`, { method: "POST", body }),
    updateCategory: (
      id: string,
      body: { title?: string; description?: string | null; position?: number },
    ) => request(`/admin/practice/categories/${id}`, { method: "PATCH", body }),
    deleteCategory: (id: string) =>
      request<void>(`/admin/practice/categories/${id}`, { method: "DELETE" }),
    checkpoints: (courseId: string) =>
      get<CheckpointRow[]>(`/admin/content/courses/${courseId}/checkpoints`),
    createCheckpoint: (courseId: string, body: { title: string; dueDate?: string | null }) =>
      request(`/admin/content/courses/${courseId}/checkpoints`, { method: "POST", body }),
    deleteCheckpoint: (courseId: string, id: string) =>
      request<void>(`/admin/content/courses/${courseId}/checkpoints/${id}`, { method: "DELETE" }),
    topics: (subjectId: string) =>
      get<{ items: Topic[] }>(`/admin/content/topics?subjectId=${subjectId}&pageSize=100`),

    // Question reports & sketches
    reports: (status?: "OPEN" | "RESOLVED") =>
      get<QuestionReportView[]>(`/admin/question-reports${status ? `?status=${status}` : ""}`),
    setReportStatus: (id: string, status: "OPEN" | "RESOLVED") =>
      request<void>(`/admin/question-reports/${id}`, { method: "PATCH", body: { status } }),
    sketches: (status: "pending" | "reviewed") =>
      get<SketchReviewQueueItem[]>(`/admin/sketches?status=${status}`),
    reviewSketch: (
      answerId: string,
      body: { scores: Record<string, number>; marks: number; comment?: string },
    ) => request<void>(`/admin/sketches/${answerId}/review`, { method: "PUT", body }),

    sketchComments: (answerId: string) =>
      get<SketchCommentView[]>(`/admin/sketches/${answerId}/comments`),
    addSketchComment: (answerId: string, body: { x: number; y: number; body: string }) =>
      request<SketchCommentView[]>(`/admin/sketches/${answerId}/comments`, {
        method: "POST",
        body,
      }),
    deleteSketchComment: (id: string) =>
      request<void>(`/admin/sketches/comments/${id}`, { method: "DELETE" }),

    // Colleges, webinars, enquiries
    colleges: () => get<AdminCollege[]>("/admin/colleges"),
    createCollege: (body: CollegeInput) => request("/admin/colleges", { method: "POST", body }),
    updateCollege: (id: string, body: Partial<CollegeInput>) =>
      request(`/admin/colleges/${id}`, { method: "PATCH", body }),
    deleteCollege: (id: string) => request<void>(`/admin/colleges/${id}`, { method: "DELETE" }),
    webinars: () => get<AdminWebinar[]>("/admin/webinars"),
    createWebinar: (body: WebinarInput) => request("/admin/webinars", { method: "POST", body }),
    updateWebinar: (id: string, body: Partial<WebinarInput>) =>
      request(`/admin/webinars/${id}`, { method: "PATCH", body }),
    deleteWebinar: (id: string) => request<void>(`/admin/webinars/${id}`, { method: "DELETE" }),
    enquiries: () => get<CollegeEnquiryView[]>("/admin/college-enquiries"),
    setEnquiryStatus: (id: string, status: "NEW" | "CONTACTED") =>
      request<void>(`/admin/college-enquiries/${id}`, { method: "PATCH", body: { status } }),

    // Cohorts
    cohorts: () => get<CohortView[]>("/admin/cohorts"),
    createCohort: (body: { name: string; batch?: string }) =>
      request("/admin/cohorts", { method: "POST", body }),
    deleteCohort: (id: string) => request<void>(`/admin/cohorts/${id}`, { method: "DELETE" }),
    cohortMembers: (id: string) =>
      get<{ userId: string; email: string; name: string }[]>(`/admin/cohorts/${id}/members`),
    addCohortMembers: (id: string, emails: string[]) =>
      request<{ added: number; notFound: string[] }>(`/admin/cohorts/${id}/members`, {
        method: "POST",
        body: { emails },
      }),
    removeCohortMember: (id: string, userId: string) =>
      request<void>(`/admin/cohorts/${id}/members/${userId}`, { method: "DELETE" }),
  };
}
