"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AttemptHistoryItem,
  AttemptResult,
  AttemptReview,
  AttemptState,
  PaginatedData,
  QuizStudentDetail,
  QuizSummary,
} from "@examora/types";

/** Typed wrappers over the student-facing quiz catalog + attempt endpoints. */
export function useQuizApi() {
  const { request } = useAuth();

  return {
    listQuizzes: () =>
      request<PaginatedData<QuizSummary>>("/quiz-catalog/quizzes?pageSize=100", { method: "GET" }),
    getQuiz: (id: string) =>
      request<QuizStudentDetail>(`/quiz-catalog/quizzes/${id}`, { method: "GET" }),

    startAttempt: (quizId: string) =>
      request<AttemptState>("/quiz-attempts", { method: "POST", body: { quizId } }),
    getAttempt: (attemptId: string) =>
      request<AttemptState>(`/quiz-attempts/${attemptId}`, { method: "GET" }),
    autosaveAnswer: (attemptId: string, questionId: string, selectedOptionIds: string[]) =>
      request<void>(`/quiz-attempts/${attemptId}/answers`, {
        method: "PATCH",
        body: { questionId, selectedOptionIds },
      }),
    submitAttempt: (attemptId: string) =>
      request<AttemptResult>(`/quiz-attempts/${attemptId}/submit`, { method: "POST" }),
    getResult: (attemptId: string) =>
      request<AttemptResult>(`/quiz-attempts/${attemptId}/result`, { method: "GET" }),
    getReview: (attemptId: string) =>
      request<AttemptReview>(`/quiz-attempts/${attemptId}/review`, { method: "GET" }),
    listHistory: (quizId?: string) =>
      request<PaginatedData<AttemptHistoryItem>>(
        `/quiz-attempts?pageSize=50${quizId ? `&quizId=${quizId}` : ""}`,
        { method: "GET" },
      ),
  };
}
