"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AdminCollege,
  AdminWebinar,
  BatchMode,
  BatchSlot,
  CohortView,
  CollegeEnquiryView,
  QuestionReportView,
  SketchCommentView,
  SketchReportView,
  SketchRubricView,
  SketchRevisionQueueItem,
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
/** Batch fields (all optional on update). Dates are YYYY-MM-DD, times HH:MM (India time). */
export interface BatchInput {
  name?: string;
  batch?: string | null;
  courseId?: string | null;
  mode?: BatchMode;
  schedule?: BatchSlot[];
  startsOn?: string | null;
  endsOn?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  isActive?: boolean;
}

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

    // Sketch rating sets & reported sketches
    rubrics: () => get<SketchRubricView[]>("/admin/sketch-works/rubrics"),
    createRubric: (body: {
      title: string;
      factors: { title: string; description: string | null }[];
    }) => request<SketchRubricView[]>("/admin/sketch-works/rubrics", { method: "POST", body }),
    updateRubric: (
      id: string,
      body: { title?: string; factors?: { title: string; description: string | null }[] },
    ) =>
      request<SketchRubricView[]>(`/admin/sketch-works/rubrics/${id}`, { method: "PATCH", body }),
    deleteRubric: (id: string) =>
      request<void>(`/admin/sketch-works/rubrics/${id}`, { method: "DELETE" }),
    revisions: (status: "pending" | "reviewed") =>
      get<SketchRevisionQueueItem[]>(`/admin/sketch-works/revisions?status=${status}`),
    rateRevision: (
      versionId: string,
      body: { scores: Record<string, number>; comment: string | null },
    ) => request<void>(`/admin/sketch-works/versions/${versionId}/expert`, { method: "PUT", body }),
    sketchReports: (status: "OPEN" | "RESOLVED") =>
      get<SketchReportView[]>(`/admin/sketch-works/reports?status=${status}`),
    setSketchReport: (id: string, status: "OPEN" | "RESOLVED") =>
      request<void>(`/admin/sketch-works/reports/${id}`, { method: "PATCH", body: { status } }),

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
    createCohort: (body: BatchInput & { name: string }) =>
      request<CohortView>("/admin/cohorts", { method: "POST", body }),
    updateCohort: (id: string, body: BatchInput) =>
      request<CohortView>(`/admin/cohorts/${id}`, { method: "PATCH", body }),
    /** One batch mentor plus an optional cover mentor until a date. */
    setCohortMentors: (
      id: string,
      input: { mentorId: string | null; coverId: string | null; coverEndsOn: string | null },
    ) => request<CohortView>(`/admin/cohorts/${id}/mentors`, { method: "PUT", body: input }),
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
