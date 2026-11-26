"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AnswerMethod,
  LessonPracticeQuestion,
  LearnCourseOption,
  LearnCourseOverview,
  LearnLessonCompleteResult,
  LearnLessonDetail,
  LearnQuizInfo,
  LearnSubjectDetail,
  LearnTopicDetail,
  TopicMarkValue,
  TopicRatingValue,
} from "@examora/types";

/** Typed wrappers over the student Learn endpoints (licence required). */
export function useLearnApi() {
  const { request } = useAuth();
  return {
    listCourses: () => request<LearnCourseOption[]>("/learn/courses", { method: "GET" }),
    getCourse: (id: string) =>
      request<LearnCourseOverview>(`/learn/courses/${id}`, { method: "GET" }),
    getSubject: (id: string) =>
      request<LearnSubjectDetail>(`/learn/subjects/${id}`, { method: "GET" }),
    getTopic: (id: string) => request<LearnTopicDetail>(`/learn/topics/${id}`, { method: "GET" }),
    markTopic: (id: string, patch: Partial<TopicMarkValue>) =>
      request<TopicMarkValue>(`/learn/topics/${id}/mark`, { method: "PUT", body: patch }),
    rateTopic: (id: string, rating: TopicRatingValue) =>
      request<void>(`/learn/topics/${id}/rating`, { method: "PUT", body: { rating } }),
    getLesson: (id: string) =>
      request<LearnLessonDetail>(`/learn/lessons/${id}`, { method: "GET" }),
    completeLesson: (id: string) =>
      request<LearnLessonCompleteResult>(`/learn/lessons/${id}/complete`, { method: "POST" }),
    answerLessonQuestion: (
      lessonId: string,
      linkId: string,
      body: { optionIds?: string[]; numericValue?: number; method: AnswerMethod },
    ) =>
      request<LessonPracticeQuestion>(`/learn/lessons/${lessonId}/questions/${linkId}/answer`, {
        method: "POST",
        body,
      }),
    getQuiz: (id: string) => request<LearnQuizInfo>(`/learn/quizzes/${id}`, { method: "GET" }),
  };
}
