"use client";

import * as React from "react";
import type {
  AchievementSummary,
  ActivitySummary,
  AssignmentPerformanceSummary,
  CourseCompletionEntry,
  LearningProgressSummary,
  LearningTimelineEntry,
  QuizPerformanceSummary,
} from "@examora/types";
import type { ContinueLearningItem } from "@examora/types";
import { useAnalyticsApi } from "@/lib/analytics-api";
import { useRecommendationsApi } from "@/lib/recommendations-api";

type Status = "loading" | "ready" | "error";

export function useStudentAnalytics() {
  const analyticsApi = useAnalyticsApi();
  const recommendationsApi = useRecommendationsApi();

  const [status, setStatus] = React.useState<Status>("loading");
  const [progress, setProgress] = React.useState<LearningProgressSummary | null>(null);
  const [courses, setCourses] = React.useState<CourseCompletionEntry[]>([]);
  const [quiz, setQuiz] = React.useState<QuizPerformanceSummary | null>(null);
  const [assignments, setAssignments] = React.useState<AssignmentPerformanceSummary | null>(null);
  const [timeline, setTimeline] = React.useState<LearningTimelineEntry[]>([]);
  const [activity, setActivity] = React.useState<ActivitySummary | null>(null);
  const [achievements, setAchievements] = React.useState<AchievementSummary | null>(null);
  const [continueLearning, setContinueLearning] = React.useState<ContinueLearningItem[]>([]);

  const load = React.useCallback(() => {
    setStatus("loading");
    Promise.all([
      analyticsApi.getProgress(),
      analyticsApi.getCourseCompletion(),
      analyticsApi.getQuizPerformance(),
      analyticsApi.getAssignmentPerformance(),
      analyticsApi.getTimeline(20),
      analyticsApi.getActivity(),
      analyticsApi.getAchievements(),
      recommendationsApi.getContinueLearning(),
    ])
      .then(([p, c, q, a, t, act, ach, cl]) => {
        setProgress(p);
        setCourses(c);
        setQuiz(q);
        setAssignments(a);
        setTimeline(t);
        setActivity(act);
        setAchievements(ach);
        setContinueLearning(cl);
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
    progress,
    courses,
    quiz,
    assignments,
    timeline,
    activity,
    achievements,
    continueLearning,
    retry: load,
  };
}
