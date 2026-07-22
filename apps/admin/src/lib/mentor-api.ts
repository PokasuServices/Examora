"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AssignedStudentSummary,
  MentorAssignment,
  MentorDashboard,
  MentorFeedback,
  MentorMeeting,
  MentorNote,
  MentorProfile,
  MentorTask,
  MentorTaskStatus,
  MentorWorkload,
  PaginatedData,
  Student360,
} from "@examora/types";

/** Typed wrappers over the Sprint 6 mentor management, Student 360, and mentor workflow endpoints. */
export function useMentorApi() {
  const { request } = useAuth();

  return {
    // Admin: mentor profiles
    listMentors: () =>
      request<PaginatedData<MentorProfile>>("/admin/mentors?pageSize=100", { method: "GET" }),
    getMentor: (id: string) => request<MentorProfile>(`/admin/mentors/${id}`, { method: "GET" }),
    createMentor: (body: {
      userId: string;
      bio?: string;
      specialization?: string;
      maxStudents?: number;
    }) => request<MentorProfile>("/admin/mentors", { method: "POST", body }),
    updateMentor: (id: string, body: Record<string, unknown>) =>
      request<MentorProfile>(`/admin/mentors/${id}`, { method: "PATCH", body }),
    deleteMentor: (id: string) => request<void>(`/admin/mentors/${id}`, { method: "DELETE" }),
    getAdminMentorDashboard: () =>
      request<{ totalMentors: number; totalActiveAssignments: number; mentors: MentorWorkload[] }>(
        "/admin/mentors/dashboard",
        { method: "GET" },
      ),

    // Admin: mentor↔student assignment
    listAssignments: (params?: { studentId?: string; mentorId?: string }) => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (params?.studentId) qs.set("studentId", params.studentId);
      if (params?.mentorId) qs.set("mentorId", params.mentorId);
      return request<PaginatedData<MentorAssignment>>(
        `/admin/mentor-assignments?${qs.toString()}`,
        {
          method: "GET",
        },
      );
    },
    assignMentor: (studentId: string, mentorId: string) =>
      request<MentorAssignment>(`/admin/mentor-assignments/${studentId}`, {
        method: "POST",
        body: { mentorId },
      }),
    unassignMentor: (studentId: string) =>
      request<void>(`/admin/mentor-assignments/${studentId}`, { method: "DELETE" }),

    // Mentor's own dashboard
    getMentorDashboard: () => request<MentorDashboard>("/mentor/dashboard", { method: "GET" }),
    listMyStudents: () => request<AssignedStudentSummary[]>("/mentor/students", { method: "GET" }),

    // Student 360
    getStudent360: (studentId: string) =>
      request<Student360>(`/students/${studentId}/360`, { method: "GET" }),

    // Mentor workflow: notes
    listNotes: (studentId: string) =>
      request<MentorNote[]>(`/students/${studentId}/notes`, { method: "GET" }),
    addNote: (studentId: string, body: string) =>
      request<MentorNote>(`/students/${studentId}/notes`, { method: "POST", body: { body } }),
    updateNote: (studentId: string, noteId: string, body: string) =>
      request<MentorNote>(`/students/${studentId}/notes/${noteId}`, {
        method: "PATCH",
        body: { body },
      }),
    deleteNote: (studentId: string, noteId: string) =>
      request<void>(`/students/${studentId}/notes/${noteId}`, { method: "DELETE" }),

    // Mentor workflow: tasks
    listTasks: (studentId: string) =>
      request<MentorTask[]>(`/students/${studentId}/tasks`, { method: "GET" }),
    addTask: (studentId: string, body: { title: string; description?: string; dueDate?: string }) =>
      request<MentorTask>(`/students/${studentId}/tasks`, { method: "POST", body }),
    updateTaskStatus: (studentId: string, taskId: string, status: MentorTaskStatus) =>
      request<MentorTask>(`/students/${studentId}/tasks/${taskId}`, {
        method: "PATCH",
        body: { status },
      }),
    deleteTask: (studentId: string, taskId: string) =>
      request<void>(`/students/${studentId}/tasks/${taskId}`, { method: "DELETE" }),

    // Mentor workflow: feedback
    listFeedback: (studentId: string) =>
      request<MentorFeedback[]>(`/students/${studentId}/feedback`, { method: "GET" }),
    addFeedback: (studentId: string, body: string) =>
      request<MentorFeedback>(`/students/${studentId}/feedback`, {
        method: "POST",
        body: { body },
      }),

    // Mentor workflow: meetings
    listMeetings: (studentId: string) =>
      request<MentorMeeting[]>(`/students/${studentId}/meetings`, { method: "GET" }),
    addMeeting: (
      studentId: string,
      body: { occurredAt: string; durationMinutes?: number; summary?: string },
    ) => request<MentorMeeting>(`/students/${studentId}/meetings`, { method: "POST", body }),
  };
}
