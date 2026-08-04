"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AssignedStudentSummary,
  MentorDashboard,
  MentorFeedback,
  MentorMeeting,
  MentorNote,
  MentorTask,
  MentorStudentProgressEntry,
  MentorPerformanceTrendPoint,
  MentorQuizPerformanceSummary,
  MentorAssignmentReviewStats,
  MentorWorkloadSummary,
  MentorEngagementSummary,
  PaginatedData,
  ReviewerQueueItem,
  Student360,
} from "@examora/types";

/**
 * Typed wrappers over the existing mentor-workflow, Student 360, and
 * mentor-analytics endpoints (ADR-0016/ADR-0020) — the exact same backend
 * apps/admin's mentor pages already call. This file only adds a second
 * frontend HTTP client against real endpoints, matching the established
 * per-app *-api.ts pattern; no business logic is duplicated server-side.
 */
export function useMentorApi() {
  const { request } = useAuth();

  return {
    getDashboard: () => request<MentorDashboard>("/mentor/dashboard", { method: "GET" }),
    listMyStudents: () => request<AssignedStudentSummary[]>("/mentor/students", { method: "GET" }),
    getStudent360: (studentId: string) =>
      request<Student360>(`/students/${studentId}/360`, { method: "GET" }),

    listNotes: (studentId: string) =>
      request<MentorNote[]>(`/students/${studentId}/notes`, { method: "GET" }),
    createNote: (studentId: string, body: string) =>
      request<MentorNote>(`/students/${studentId}/notes`, { method: "POST", body: { body } }),
    updateNote: (studentId: string, noteId: string, body: string) =>
      request<MentorNote>(`/students/${studentId}/notes/${noteId}`, {
        method: "PATCH",
        body: { body },
      }),
    deleteNote: (studentId: string, noteId: string) =>
      request<void>(`/students/${studentId}/notes/${noteId}`, { method: "DELETE" }),

    listTasks: (studentId: string) =>
      request<MentorTask[]>(`/students/${studentId}/tasks`, { method: "GET" }),
    createTask: (
      studentId: string,
      body: { title: string; description?: string; dueDate?: string },
    ) => request<MentorTask>(`/students/${studentId}/tasks`, { method: "POST", body }),
    updateTask: (
      studentId: string,
      taskId: string,
      body: Partial<{
        title: string;
        description: string;
        dueDate: string;
        status: MentorTask["status"];
      }>,
    ) => request<MentorTask>(`/students/${studentId}/tasks/${taskId}`, { method: "PATCH", body }),
    deleteTask: (studentId: string, taskId: string) =>
      request<void>(`/students/${studentId}/tasks/${taskId}`, { method: "DELETE" }),

    listFeedback: (studentId: string) =>
      request<MentorFeedback[]>(`/students/${studentId}/feedback`, { method: "GET" }),
    createFeedback: (studentId: string, body: string) =>
      request<MentorFeedback>(`/students/${studentId}/feedback`, {
        method: "POST",
        body: { body },
      }),

    listMeetings: (studentId: string) =>
      request<MentorMeeting[]>(`/students/${studentId}/meetings`, { method: "GET" }),
    createMeeting: (
      studentId: string,
      body: { occurredAt: string; durationMinutes?: number; summary?: string },
    ) => request<MentorMeeting>(`/students/${studentId}/meetings`, { method: "POST", body }),

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

    /** Read-only queue preview — scoring/publishing a review is a separate, larger workspace not rebuilt here (see report). */
    getReviewQueue: (pageSize = 5) =>
      request<PaginatedData<ReviewerQueueItem>>(`/reviewer/queue?pageSize=${pageSize}`, {
        method: "GET",
      }),
  };
}
