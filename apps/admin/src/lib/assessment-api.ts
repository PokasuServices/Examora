"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AdminAttemptDetail,
  AdminAttemptSummary,
  ContentStatus,
  DifficultyLevel,
  PaginatedData,
  Question,
  QuestionType,
  Quiz,
  QuizAttemptStatus,
  QuizDetail,
  QuizQuestionAssignment,
  QuizResultDashboard,
  QuizSection,
} from "@examora/types";

const BASE = "/admin/assessment";

/** Thin, typed wrappers over the authenticated request helper for assessment endpoints. */
export function useAssessmentApi() {
  const { request } = useAuth();

  return {
    // Questions
    listQuestions: (params?: { status?: ContentStatus; type?: QuestionType }) => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (params?.status) qs.set("status", params.status);
      if (params?.type) qs.set("type", params.type);
      return request<PaginatedData<Question>>(`${BASE}/questions?${qs.toString()}`, {
        method: "GET",
      });
    },
    getQuestion: (id: string) => request<Question>(`${BASE}/questions/${id}`, { method: "GET" }),
    createQuestion: (body: {
      type: QuestionType;
      difficulty?: DifficultyLevel;
      text: string;
      explanation?: string;
      tags?: string[];
      options: { text: string; isCorrect: boolean }[];
    }) => request<Question>(`${BASE}/questions`, { method: "POST", body }),
    updateQuestion: (id: string, body: Record<string, unknown>) =>
      request<Question>(`${BASE}/questions/${id}`, { method: "PATCH", body }),
    setQuestionStatus: (id: string, status: ContentStatus) =>
      request<Question>(`${BASE}/questions/${id}/status`, { method: "PATCH", body: { status } }),
    deleteQuestion: (id: string) => request<void>(`${BASE}/questions/${id}`, { method: "DELETE" }),

    // Quizzes
    listQuizzes: (params?: { status?: ContentStatus }) => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (params?.status) qs.set("status", params.status);
      return request<PaginatedData<Quiz>>(`${BASE}/quizzes?${qs.toString()}`, { method: "GET" });
    },
    getQuiz: (id: string) => request<QuizDetail>(`${BASE}/quizzes/${id}`, { method: "GET" }),
    createQuiz: (body: {
      title: string;
      description?: string;
      timeLimitMinutes?: number;
      passingScorePercent?: number;
      negativeMarkingEnabled?: boolean;
      negativeMarksPerWrong?: number;
      shuffleQuestions?: boolean;
      shuffleOptions?: boolean;
    }) => request<Quiz>(`${BASE}/quizzes`, { method: "POST", body }),
    updateQuiz: (id: string, body: Record<string, unknown>) =>
      request<Quiz>(`${BASE}/quizzes/${id}`, { method: "PATCH", body }),
    setQuizStatus: (id: string, status: ContentStatus) =>
      request<Quiz>(`${BASE}/quizzes/${id}/status`, { method: "PATCH", body: { status } }),
    deleteQuiz: (id: string) => request<void>(`${BASE}/quizzes/${id}`, { method: "DELETE" }),

    // Sections
    listSections: (quizId: string) =>
      request<QuizSection[]>(`${BASE}/quizzes/${quizId}/sections`, { method: "GET" }),
    createSection: (quizId: string, body: { title: string; description?: string }) =>
      request<QuizSection>(`${BASE}/quizzes/${quizId}/sections`, { method: "POST", body }),
    deleteSection: (quizId: string, id: string) =>
      request<void>(`${BASE}/quizzes/${quizId}/sections/${id}`, { method: "DELETE" }),

    // Question assignment
    assignQuestion: (
      quizId: string,
      body: { questionId: string; sectionId?: string; marks?: number },
    ) =>
      request<QuizQuestionAssignment>(`${BASE}/quizzes/${quizId}/questions`, {
        method: "POST",
        body,
      }),
    unassignQuestion: (quizId: string, id: string) =>
      request<void>(`${BASE}/quizzes/${quizId}/questions/${id}`, { method: "DELETE" }),

    // Monitoring + results
    listAttempts: (params?: { quizId?: string; status?: QuizAttemptStatus }) => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (params?.quizId) qs.set("quizId", params.quizId);
      if (params?.status) qs.set("status", params.status);
      return request<PaginatedData<AdminAttemptSummary>>(`${BASE}/attempts?${qs.toString()}`, {
        method: "GET",
      });
    },
    getAttempt: (id: string) =>
      request<AdminAttemptDetail>(`${BASE}/attempts/${id}`, { method: "GET" }),
    getResultDashboard: (quizId: string) =>
      request<QuizResultDashboard>(`${BASE}/quizzes/${quizId}/results`, { method: "GET" }),
  };
}
