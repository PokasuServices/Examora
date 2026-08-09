"use client";

import * as React from "react";
import type { Enrollment } from "@examora/types";
import { useCommerceApi } from "@/lib/commerce-api";
import { useAnalyticsApi } from "@/lib/analytics-api";
import { useRecommendationsApi } from "@/lib/recommendations-api";

type Status = "loading" | "ready" | "error";

export interface EnrolledCourse extends Enrollment {
  completionPercent: number | null;
  nextLessonId: string | null;
  nextLessonTitle: string | null;
}

/**
 * Combines three already-existing, already-approved read endpoints — /enrollments
 * (access/status), /analytics/me/course-completion (real progress), and
 * /recommendations/me/continue-learning (real next-lesson deep link) — the
 * same cross-referencing pattern already used by the Recommendations Learning
 * Path page. No new API surface.
 */
export function useEnrollments() {
  const commerceApi = useCommerceApi();
  const analyticsApi = useAnalyticsApi();
  const recommendationsApi = useRecommendationsApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [courses, setCourses] = React.useState<EnrolledCourse[]>([]);

  const load = React.useCallback(() => {
    setStatus("loading");
    Promise.all([
      commerceApi.listMyEnrollments(),
      analyticsApi.getCourseCompletion(),
      recommendationsApi.getContinueLearning(),
    ])
      .then(([enrollmentsRes, completion, continueLearning]) => {
        const completionByCourse = new Map(completion.map((c) => [c.courseId, c]));
        const continueByCourse = new Map(continueLearning.map((c) => [c.courseId, c]));

        const merged = enrollmentsRes.items.map((enrollment) => {
          const progress = completionByCourse.get(enrollment.courseId);
          const next = continueByCourse.get(enrollment.courseId);
          return {
            ...enrollment,
            completionPercent: progress?.completionPercent ?? null,
            nextLessonId: next?.nextLesson?.id ?? null,
            nextLessonTitle: next?.nextLesson?.title ?? null,
          };
        });

        merged.sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime());
        setCourses(merged);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return { status, courses, retry: load };
}
