"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AdminSubmissionDetail,
  AdminSubmissionSummary,
  Assignment,
  AssignmentDetail,
  AssignmentSubmissionStatus,
  AssignmentTemplate,
  ContentStatus,
  FileRules,
  PaginatedData,
  ReviewDecision,
  ReviewerQueueItem,
  ReviewerSubmissionView,
  RubricCriterion,
  RubricSkeletonItem,
} from "@examora/types";

/** Typed wrappers over the admin assignment authoring, monitoring, and reviewer endpoints. */
export function useAssignmentAdminApi() {
  const { request } = useAuth();

  return {
    // Templates
    listTemplates: () =>
      request<PaginatedData<AssignmentTemplate>>("/admin/assignments/templates?pageSize=100", {
        method: "GET",
      }),
    getTemplate: (id: string) =>
      request<AssignmentTemplate>(`/admin/assignments/templates/${id}`, { method: "GET" }),
    createTemplate: (body: {
      title: string;
      brief: string;
      fileRules: FileRules;
      marksTotal: number;
      rubric: RubricSkeletonItem[];
    }) => request<AssignmentTemplate>("/admin/assignments/templates", { method: "POST", body }),
    updateTemplate: (id: string, body: Record<string, unknown>) =>
      request<AssignmentTemplate>(`/admin/assignments/templates/${id}`, { method: "PATCH", body }),
    deleteTemplate: (id: string) =>
      request<void>(`/admin/assignments/templates/${id}`, { method: "DELETE" }),

    // Assignments
    listAssignments: (params?: { status?: ContentStatus }) => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (params?.status) qs.set("status", params.status);
      return request<PaginatedData<Assignment>>(`/admin/assignments?${qs.toString()}`, {
        method: "GET",
      });
    },
    getAssignment: (id: string) =>
      request<AssignmentDetail>(`/admin/assignments/${id}`, { method: "GET" }),
    createAssignment: (body: {
      templateId?: string;
      subjectId?: string;
      title: string;
      slug?: string;
      brief?: string;
      fileRules?: FileRules;
      marksTotal?: number;
      deadline?: string;
    }) => request<AssignmentDetail>("/admin/assignments", { method: "POST", body }),
    updateAssignment: (id: string, body: Record<string, unknown>) =>
      request<AssignmentDetail>(`/admin/assignments/${id}`, { method: "PATCH", body }),
    setAssignmentStatus: (id: string, status: ContentStatus) =>
      request<Assignment>(`/admin/assignments/${id}/status`, { method: "PATCH", body: { status } }),
    deleteAssignment: (id: string) =>
      request<void>(`/admin/assignments/${id}`, { method: "DELETE" }),

    // Rubric criteria
    addCriterion: (
      assignmentId: string,
      body: { title: string; description?: string; maxMarks: number; position?: number },
    ) =>
      request<RubricCriterion>(`/admin/assignments/${assignmentId}/criteria`, {
        method: "POST",
        body,
      }),
    updateCriterion: (assignmentId: string, criterionId: string, body: Record<string, unknown>) =>
      request<RubricCriterion>(`/admin/assignments/${assignmentId}/criteria/${criterionId}`, {
        method: "PATCH",
        body,
      }),
    removeCriterion: (assignmentId: string, criterionId: string) =>
      request<void>(`/admin/assignments/${assignmentId}/criteria/${criterionId}`, {
        method: "DELETE",
      }),

    // Admin monitoring
    listSubmissions: (params?: {
      assignmentId?: string;
      reviewerId?: string;
      status?: AssignmentSubmissionStatus;
    }) => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (params?.assignmentId) qs.set("assignmentId", params.assignmentId);
      if (params?.reviewerId) qs.set("reviewerId", params.reviewerId);
      if (params?.status) qs.set("status", params.status);
      return request<PaginatedData<AdminSubmissionSummary>>(
        `/admin/assignments/submissions?${qs.toString()}`,
        { method: "GET" },
      );
    },
    getSubmissionDetail: (id: string) =>
      request<AdminSubmissionDetail>(`/admin/assignments/submissions/${id}`, { method: "GET" }),
    assignReviewer: (id: string, reviewerId: string) =>
      request<AdminSubmissionSummary>(`/admin/assignments/submissions/${id}/reviewer`, {
        method: "PATCH",
        body: { reviewerId },
      }),

    // Reviewer dashboard (assignment:review — MENTOR/REVIEWER)
    reviewerQueue: (status?: AssignmentSubmissionStatus) => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (status) qs.set("status", status);
      return request<PaginatedData<ReviewerQueueItem>>(`/reviewer/queue?${qs.toString()}`, {
        method: "GET",
      });
    },
    getReviewSubmission: (id: string) =>
      request<ReviewerSubmissionView>(`/reviewer/submissions/${id}`, { method: "GET" }),
    saveDraftReview: (
      id: string,
      body: {
        overallComment?: string;
        scores: { criterionId: string; marksAwarded: number; comment?: string }[];
      },
    ) =>
      request<ReviewerSubmissionView>(`/reviewer/submissions/${id}/review`, {
        method: "POST",
        body,
      }),
    publishReview: (id: string, decision: ReviewDecision) =>
      request<ReviewerSubmissionView>(`/reviewer/submissions/${id}/review/publish`, {
        method: "POST",
        body: { decision },
      }),

    // Shared submission endpoints (owner-or-assigned-reviewer gated)
    getDownloadUrl: (submissionId: string, fileId: string) =>
      request<{ url: string }>(
        `/assignment-submissions/${submissionId}/files/${fileId}/download-url`,
        {
          method: "GET",
        },
      ),
    addComment: (submissionId: string, body: string) =>
      request(`/assignment-submissions/${submissionId}/comments`, {
        method: "POST",
        body: { body },
      }),
  };
}
