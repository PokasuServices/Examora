"use client";

import * as React from "react";
import type {
  AssignmentRecommendation,
  ContinueLearningItem,
  CourseRecommendation,
  LearningPathStep,
  QuizRecommendation,
  RelatedDiscussionRecommendation,
  SimilarCourseRecommendation,
} from "@examora/types";
import { useRecommendationsApi } from "@/lib/recommendations-api";

type Status = "loading" | "ready" | "error";

export function useRecommendationsHome() {
  const api = useRecommendationsApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [continueLearning, setContinueLearning] = React.useState<ContinueLearningItem[]>([]);
  const [courses, setCourses] = React.useState<CourseRecommendation[]>([]);
  const [similarCourses, setSimilarCourses] = React.useState<SimilarCourseRecommendation[]>([]);
  const [learningPath, setLearningPath] = React.useState<LearningPathStep[]>([]);
  const [quizzes, setQuizzes] = React.useState<QuizRecommendation[]>([]);
  const [assignments, setAssignments] = React.useState<AssignmentRecommendation[]>([]);
  const [discussions, setDiscussions] = React.useState<RelatedDiscussionRecommendation[]>([]);

  const load = React.useCallback(() => {
    setStatus("loading");
    Promise.all([
      api.getContinueLearning(),
      api.getRecommendedCourses(),
      api.getSimilarCourses(),
      api.getLearningPath(),
      api.getRecommendedQuizzes(),
      api.getRecommendedAssignments(),
      api.getRelatedDiscussions(),
    ])
      .then(([cl, c, sc, lp, q, a, d]) => {
        setContinueLearning(cl);
        setCourses(c);
        setSimilarCourses(sc);
        setLearningPath(lp);
        setQuizzes(q);
        setAssignments(a);
        setDiscussions(d);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return {
    status,
    continueLearning,
    courses,
    similarCourses,
    learningPath,
    quizzes,
    assignments,
    discussions,
    retry: load,
  };
}
