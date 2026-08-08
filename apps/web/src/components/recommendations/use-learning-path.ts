"use client";

import * as React from "react";
import type { ContinueLearningItem, CourseCompletionEntry, LearningPathStep } from "@examora/types";
import { useAnalyticsApi } from "@/lib/analytics-api";
import { useRecommendationsApi } from "@/lib/recommendations-api";

type Status = "loading" | "ready" | "error";

/**
 * The roadmap is an honest composition of three real, already-used
 * endpoints — no single endpoint returns "my whole path" as one shape:
 * completed milestones from analytics' course-completion breakdown (100%
 * complete), current position from recommendations' continue-learning list,
 * and next steps from the real learning-path recommendation order.
 */
export function useLearningPath() {
  const analyticsApi = useAnalyticsApi();
  const recommendationsApi = useRecommendationsApi();

  const [status, setStatus] = React.useState<Status>("loading");
  const [completed, setCompleted] = React.useState<CourseCompletionEntry[]>([]);
  const [current, setCurrent] = React.useState<ContinueLearningItem[]>([]);
  const [next, setNext] = React.useState<LearningPathStep[]>([]);

  const load = React.useCallback(() => {
    setStatus("loading");
    Promise.all([
      analyticsApi.getCourseCompletion(),
      recommendationsApi.getContinueLearning(),
      recommendationsApi.getLearningPath(),
    ])
      .then(([completion, cl, path]) => {
        setCompleted(completion.filter((c) => c.completionPercent >= 100));
        setCurrent(cl);
        setNext(path);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return { status, completed, current, next, retry: load };
}
