"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AttendanceGrid,
  AttendanceMarkInput,
  AttendanceOverviewRow,
  AttendancePeriod,
  BatchAnnouncementView,
  BatchProgressView,
  ClassSessionView,
  DailyCalendarView,
  DailyScheduleInput,
  DailyScheduleItem,
  DuplicateMatch,
  ImportPreview,
  ImportResult,
  MentorDoubtItem,
  MentorDoubtThread,
  MentorTodayView,
  MentorWorkloadView,
  ProgressReportKind,
  ProgressReportView,
  ReviewableContentType,
  ReviewInbox,
  SessionRoster,
  ShoutoutBadge,
  ShoutoutView,
  StaffRequestKind,
  StaffRequestView,
} from "@examora/types";

const API_ORIGIN = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "http://localhost:3001/api/v1";

export interface QuizBatches {
  everyone: boolean;
  batches: {
    id: string;
    name: string;
    courseTitle: string | null;
    students: number;
    selected: boolean;
  }[];
  others: number;
}

export interface PoolQuestion {
  id: string;
  text: string;
  type: string;
  difficulty: string;
  topic: string | null;
}

const q = (params: Record<string, string | undefined | null>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : "";
};

/** Reads a File as base64 (no data: prefix), for Excel uploads. */
export async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000)
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Saves a base64 .xlsx returned by an upload (the "failed rows" file). */
export function saveBase64Xlsx(base64: string, fileName: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** The mentor module's API (staff workspace). */
export function useDeskApi() {
  const { request, accessToken } = useAuth();

  /** Downloads an .xlsx from an authenticated GET (refreshing the session once if needed). */
  async function download(path: string, fallbackName: string) {
    const get = (token: string | null) =>
      fetch(`${API_ORIGIN}${path}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    let res = await get(accessToken);
    if (res.status === 401) {
      const r = await fetch(`${API_ORIGIN}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await r.json().catch(() => null)) as { data?: { accessToken?: string } } | null;
      res = await get(body?.data?.accessToken ?? null);
    }
    if (!res.ok) {
      let message = "Couldn't download the file";
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        message = body.error?.message ?? message;
      } catch {
        /* not JSON */
      }
      throw new Error(message);
    }
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return {
    download,
    today: () => request<MentorTodayView>("/mentor-desk/today", { method: "GET" }),
    workload: () => request<MentorWorkloadView>("/mentor-desk/workload", { method: "GET" }),
    performance: () =>
      request<MentorWorkloadView[]>("/mentor-desk/admin/performance", { method: "GET" }),
    batchProgress: (cohortId: string) =>
      request<BatchProgressView>(`/mentor-desk/batches/${cohortId}/progress`, { method: "GET" }),

    // attendance
    sessions: (from: string, to: string, cohortId?: string) =>
      request<ClassSessionView[]>(`/mentor-desk/attendance/sessions${q({ from, to, cohortId })}`, {
        method: "GET",
      }),
    roster: (id: string) =>
      request<SessionRoster>(`/mentor-desk/attendance/sessions/${id}`, { method: "GET" }),
    mark: (id: string, input: AttendanceMarkInput) =>
      request<SessionRoster>(`/mentor-desk/attendance/sessions/${id}`, {
        method: "PUT",
        body: input,
      }),
    addSession: (input: {
      cohortId: string;
      date: string;
      start: string;
      end: string;
      mode?: "OFFLINE" | "ONLINE";
      topic?: string;
    }) =>
      request<ClassSessionView>("/mentor-desk/attendance/sessions", {
        method: "POST",
        body: input,
      }),
    updateSession: (id: string, input: { cancelled?: boolean; topic?: string | null }) =>
      request<ClassSessionView>(`/mentor-desk/attendance/sessions/${id}`, {
        method: "PATCH",
        body: input,
      }),
    grid: (cohortId: string, from: string, to: string) =>
      request<AttendanceGrid>(`/mentor-desk/attendance/grid${q({ cohortId, from, to })}`, {
        method: "GET",
      }),
    overview: (month: string, courseId?: string) =>
      request<AttendanceOverviewRow[]>(
        `/mentor-desk/attendance/overview${q({ month, courseId })}`,
        { method: "GET" },
      ),
    attendanceExportPath: (
      cohortId: string,
      period: AttendancePeriod,
      date: string,
      template: boolean,
    ) =>
      `/mentor-desk/attendance/${template ? "template" : "export"}${q({ cohortId, period, date })}`,
    importAttendance: (
      cohortId: string,
      contentBase64: string,
      fileName: string,
      dryRun: boolean,
    ) =>
      request<ImportPreview | ImportResult>(
        `/mentor-desk/attendance/import/${cohortId}${q({ dryRun: String(dryRun) })}`,
        {
          method: "POST",
          body: { fileName, contentBase64 },
        },
      ),

    // reviews & doubts
    reviews: () => request<ReviewInbox>("/mentor-desk/reviews", { method: "GET" }),
    doubts: (status: "open" | "resolved" | "all", scope: "batches" | "course") =>
      request<MentorDoubtItem[]>(`/mentor-desk/doubts${q({ status, scope })}`, { method: "GET" }),
    doubt: (id: string) =>
      request<MentorDoubtThread>(`/mentor-desk/doubts/${id}`, { method: "GET" }),
    replyDoubt: (id: string, body: string, resolve: boolean) =>
      request<MentorDoubtThread>(`/mentor-desk/doubts/${id}/reply`, {
        method: "POST",
        body: { body, resolve },
      }),
    resolveDoubt: (id: string, resolved: boolean) =>
      request<MentorDoubtThread>(`/mentor-desk/doubts/${id}/resolved`, {
        method: "PUT",
        body: { resolved },
      }),

    // daily quiz calendar & tests
    calendar: (courseId: string, from: string, to: string) =>
      request<DailyCalendarView>(`/mentor-desk/daily${q({ courseId, from, to })}`, {
        method: "GET",
      }),
    dailyPool: (courseId: string, search?: string) =>
      request<PoolQuestion[]>(`/mentor-desk/daily/pool${q({ courseId, search })}`, {
        method: "GET",
      }),
    scheduleDaily: (input: DailyScheduleInput) =>
      request<DailyScheduleItem>("/mentor-desk/daily", { method: "POST", body: input }),
    rescheduleDaily: (
      id: string,
      input: { date?: string; title?: string; questionIds?: string[] },
    ) => request<DailyScheduleItem>(`/mentor-desk/daily/${id}`, { method: "PATCH", body: input }),
    quizBatches: (quizId: string) =>
      request<QuizBatches>(`/mentor-desk/quizzes/${quizId}/batches`, { method: "GET" }),
    setQuizBatches: (quizId: string, cohortIds: string[]) =>
      request<QuizBatches>(`/mentor-desk/quizzes/${quizId}/batches`, {
        method: "PUT",
        body: { cohortIds },
      }),
    duplicates: (input: {
      text: string;
      imageUrl?: string | null;
      courseId?: string | null;
      excludeId?: string | null;
    }) =>
      request<DuplicateMatch[]>("/mentor-desk/questions/duplicates", {
        method: "POST",
        body: input,
      }),
    importQuestions: (
      target: { quizId?: string; courseId?: string },
      contentBase64: string,
      fileName: string,
      dryRun: boolean,
    ) =>
      request<ImportPreview | ImportResult>(
        `/mentor-desk/questions/import${q({ quizId: target.quizId, courseId: target.courseId, dryRun: String(dryRun) })}`,
        { method: "POST", body: { fileName, contentBase64 } },
      ),
    importMarks: (quizId: string, contentBase64: string, fileName: string, dryRun: boolean) =>
      request<ImportPreview | ImportResult>(
        `/mentor-desk/quizzes/${quizId}/marks/import${q({ dryRun: String(dryRun) })}`,
        {
          method: "POST",
          body: { fileName, contentBase64 },
        },
      ),

    // reports
    reports: (
      params: { status?: string; studentId?: string; kind?: string; period?: string } = {},
    ) => request<ProgressReportView[]>(`/mentor-desk/reports${q(params)}`, { method: "GET" }),
    report: (id: string) =>
      request<ProgressReportView>(`/mentor-desk/reports/${id}`, { method: "GET" }),
    createReport: (input: {
      studentId: string;
      kind: ProgressReportKind;
      period?: string;
      remarks?: string;
    }) => request<ProgressReportView>("/mentor-desk/reports", { method: "POST", body: input }),
    prepareMonth: (month: string) =>
      request<{ created: number }>("/mentor-desk/reports/prepare-month", {
        method: "POST",
        body: { month },
      }),
    updateReport: (id: string, input: { remarks?: string; refresh?: boolean }) =>
      request<ProgressReportView>(`/mentor-desk/reports/${id}`, { method: "PATCH", body: input }),
    submitReport: (id: string) =>
      request<ProgressReportView>(`/mentor-desk/reports/${id}/submit`, { method: "POST" }),
    approveReport: (id: string, note?: string) =>
      request<ProgressReportView>(`/staff-requests/reports/${id}/approve`, {
        method: "POST",
        body: { note },
      }),
    returnReport: (id: string, note: string) =>
      request<ProgressReportView>(`/staff-requests/reports/${id}/return`, {
        method: "POST",
        body: { note },
      }),

    // shout-outs & announcements
    shoutouts: () =>
      request<{ given: ShoutoutView[]; left: number }>("/mentor-desk/shoutouts", { method: "GET" }),
    giveShoutout: (input: { studentId: string; badge: ShoutoutBadge; note?: string }) =>
      request<ShoutoutView>("/mentor-desk/shoutouts", { method: "POST", body: input }),
    announcements: (cohortId?: string) =>
      request<BatchAnnouncementView[]>(`/mentor-desk/announcements${q({ cohortId })}`, {
        method: "GET",
      }),
    announce: (input: {
      cohortIds: string[];
      title: string;
      body: string;
      linkUrl?: string | null;
    }) =>
      request<BatchAnnouncementView[]>("/mentor-desk/announcements", {
        method: "POST",
        body: input,
      }),

    // staff requests
    requestPublish: (targetType: ReviewableContentType, targetId: string, note?: string) =>
      request<StaffRequestView>("/staff-requests/publish", {
        method: "POST",
        body: { targetType, targetId, note },
      }),
    requestStudent: (input: {
      cohortId: string;
      name: string;
      email: string;
      phone?: string;
      note?: string;
    }) => request<StaffRequestView>("/staff-requests/new-student", { method: "POST", body: input }),
    pendingContent: (ids: string[]) =>
      request<Record<string, StaffRequestKind[]>>("/staff-requests/pending-content", {
        method: "POST",
        body: { ids },
      }),
    myRequests: () => request<StaffRequestView[]>("/staff-requests/mine", { method: "GET" }),
    staffRequests: (status?: string, kind?: string) =>
      request<StaffRequestView[]>(`/staff-requests${q({ status, kind })}`, { method: "GET" }),
    approveRequest: (id: string, note?: string) =>
      request<StaffRequestView>(`/staff-requests/${id}/approve`, {
        method: "POST",
        body: { note },
      }),
    rejectRequest: (id: string, note: string) =>
      request<StaffRequestView>(`/staff-requests/${id}/reject`, { method: "POST", body: { note } }),
    importMembers: (cohortId: string, contentBase64: string, fileName: string, dryRun: boolean) =>
      request<ImportPreview | ImportResult>(
        `/staff-requests/batches/${cohortId}/members/import${q({ dryRun: String(dryRun) })}`,
        {
          method: "POST",
          body: { fileName, contentBase64 },
        },
      ),
  };
}
