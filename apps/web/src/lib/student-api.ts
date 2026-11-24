"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AnswerMethod,
  AttemptAnalysis,
  CheckpointView,
  CollegeDetail,
  CollegeSummary,
  DailyQuizQuestion,
  DailyQuizResult,
  DailyQuizStatus,
  GoalView,
  LeaderboardEntry,
  PracticeOverview,
  PracticeTestDetail,
  PresignedUpload,
  ProfileActivityItem,
  ProfileOverview,
  ProfilePerformancePoint,
  QuestionDoubtView,
  RevisionItem,
  SketchCommentView,
  SketchGalleryItem,
  SketchView,
  SubmissionHistoryItem,
  TestShareInfo,
  TestShareVisitResult,
  WebinarDetail,
  WebinarSummary,
} from "@examora/types";

/** Typed wrappers over the student module's practice, report, sketch, daily quiz, college and profile endpoints. */
export function useStudentApi() {
  const { request } = useAuth();
  const get = <T>(path: string) => request<T>(path, { method: "GET" });

  return {
    // Practice
    practice: (courseId: string) => get<PracticeOverview>(`/practice/courses/${courseId}`),
    practiceTest: (id: string) => get<PracticeTestDetail>(`/practice/tests/${id}`),
    testShare: (id: string) => get<TestShareInfo>(`/practice/tests/${id}/share`),
    createTestShare: (id: string) =>
      request<TestShareInfo>(`/practice/tests/${id}/share`, { method: "POST" }),
    visitTestShare: (code: string) =>
      request<TestShareVisitResult>(`/practice/shares/${encodeURIComponent(code)}/visit`, {
        method: "POST",
      }),
    markStudied: (topicId: string, studied: boolean) =>
      request<void>(`/practice/topics/${topicId}/studied`, { method: "PUT", body: { studied } }),

    // Attempt bookkeeping
    questionMeta: (
      attemptId: string,
      questionId: string,
      body: {
        visited?: boolean;
        flagged?: boolean;
        method?: AnswerMethod | null;
        addSeconds?: number;
      },
    ) =>
      request<void>(`/quiz-attempts/${attemptId}/questions/${questionId}/meta`, {
        method: "PATCH",
        body,
      }),
    presignSketch: (attemptId: string, questionId: string, file: File) =>
      request<PresignedUpload>(
        `/quiz-attempts/${attemptId}/questions/${questionId}/upload/presign`,
        {
          method: "POST",
          body: { fileName: file.name, mimeType: file.type, sizeBytes: file.size },
        },
      ),
    confirmSketch: (attemptId: string, questionId: string, file: File, storageKey: string) =>
      request<{ ref: string }>(
        `/quiz-attempts/${attemptId}/questions/${questionId}/upload/confirm`,
        {
          method: "POST",
          body: { fileName: file.name, mimeType: file.type, sizeBytes: file.size, storageKey },
        },
      ),

    // Report
    analysis: (attemptId: string) => get<AttemptAnalysis>(`/quiz-attempts/${attemptId}/analysis`),
    leaderboard: (attemptId: string) =>
      get<LeaderboardEntry[]>(`/quiz-attempts/${attemptId}/leaderboard`),
    reportQuestion: (questionId: string, message: string, attemptId?: string) =>
      request<void>(`/questions/${questionId}/reports`, {
        method: "POST",
        body: { message, attemptId },
      }),
    doubts: (questionId: string) => get<QuestionDoubtView[]>(`/questions/${questionId}/doubts`),
    postDoubt: (questionId: string, body: string, parentId?: string) =>
      request<void>(`/questions/${questionId}/doubts`, {
        method: "POST",
        body: { body, parentId },
      }),
    clap: (doubtId: string) =>
      request<{ clapped: boolean }>(`/questions/doubts/${doubtId}/clap`, { method: "POST" }),
    deleteDoubt: (doubtId: string) =>
      request<void>(`/questions/doubts/${doubtId}`, { method: "DELETE" }),

    // Sketches
    mySketches: () => get<SketchView[]>("/sketches/mine"),
    sketchComments: (answerId: string) =>
      get<SketchCommentView[]>(`/sketches/${answerId}/comments`),
    addSketchComment: (answerId: string, body: { x: number; y: number; body: string }) =>
      request<SketchCommentView[]>(`/sketches/${answerId}/comments`, { method: "POST", body }),
    deleteSketchComment: (id: string) =>
      request<void>(`/sketches/comments/${id}`, { method: "DELETE" }),
    selfRate: (answerId: string, scores: Record<string, number>) =>
      request<SketchView>(`/sketches/${answerId}/self`, { method: "PUT", body: { scores } }),
    gallery: (questionId: string) =>
      get<SketchGalleryItem[]>(`/sketches/questions/${questionId}/gallery`),
    peerRate: (answerId: string, score: number) =>
      request<void>(`/sketches/${answerId}/peer`, { method: "PUT", body: { score } }),

    // Daily quiz
    dailyStatus: () => get<DailyQuizStatus>("/daily-quiz/today"),
    dailyStart: () => request<DailyQuizQuestion[]>("/daily-quiz/today/start", { method: "POST" }),
    dailyFinish: (answers: { questionId: string; optionId: string | null; ms: number }[]) =>
      request<DailyQuizResult>("/daily-quiz/today/finish", { method: "POST", body: { answers } }),
    dailyLeaderboard: () => get<DailyQuizResult["leaderboard"]>("/daily-quiz/today/leaderboard"),

    // Colleges & webinars
    colleges: (category?: string) =>
      get<CollegeSummary[]>(
        `/colleges${category ? `?category=${encodeURIComponent(category)}` : ""}`,
      ),
    college: (slug: string) => get<CollegeDetail>(`/colleges/${encodeURIComponent(slug)}`),
    shortlist: () => get<CollegeSummary[]>("/colleges/shortlist"),
    setShortlisted: (id: string, on: boolean) =>
      request<void>(`/colleges/${id}/shortlist`, { method: "PUT", body: { on } }),
    enquire: (id: string, message: string) =>
      request<void>(`/colleges/${id}/enquiries`, { method: "POST", body: { message } }),
    webinars: () => get<WebinarSummary[]>("/webinars"),
    webinar: (slug: string) => get<WebinarDetail>(`/webinars/${encodeURIComponent(slug)}`),
    setRegistered: (id: string, on: boolean) =>
      request<void>(`/webinars/${id}/registration`, { method: "PUT", body: { on } }),

    // Profile
    profile: () => get<ProfileOverview>("/me/profile"),
    mySubmissions: () =>
      get<{ items: SubmissionHistoryItem[] }>("/assignment-submissions").then((r) => r.items),
    activity: () => get<ProfileActivityItem[]>("/me/activity"),
    performance: (courseId: string, categoryId?: string) =>
      get<ProfilePerformancePoint[]>(
        `/me/performance?courseId=${courseId}${categoryId ? `&categoryId=${categoryId}` : ""}`,
      ),
    revision: () => get<RevisionItem[]>("/me/revision"),
    goals: () => get<GoalView[]>("/me/goals"),
    setGoal: (courseId: string, targetPercent: number, note?: string) =>
      request<void>("/me/goals", { method: "PUT", body: { courseId, targetPercent, note } }),
    checkpoints: () => get<CheckpointView[]>("/me/checkpoints"),
    setCheckpoint: (id: string, done: boolean) =>
      request<void>(`/me/checkpoints/${id}`, { method: "PUT", body: { done } }),
  };
}

/** PUTs a file straight to its presigned storage URL; throws if storage rejects it. */
export async function putToStorage(url: string, file: File): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

export const METHOD_LABEL: Record<AnswerMethod, string> = {
  KNOWLEDGE: "Knew it",
  ELIMINATION: "Ruled out options",
  GUESS: "Guessed",
};

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
