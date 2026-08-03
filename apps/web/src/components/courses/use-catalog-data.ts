"use client";

import * as React from "react";
import type { Course, CourseCompletionEntry, Enrollment } from "@examora/types";
import { useLearningApi } from "@/lib/learning-api";
import { useCommerceApi } from "@/lib/commerce-api";
import { useAnalyticsApi } from "@/lib/analytics-api";
import { useRecommendationsApi } from "@/lib/recommendations-api";
import type { CourseStatus, EnrichedCourse } from "./types";

type State =
  { status: "loading" } | { status: "error" } | { status: "ready"; courses: EnrichedCourse[] };

function deriveStatus(
  course: Course,
  activeEnrollment: Enrollment | undefined,
  completion: CourseCompletionEntry | undefined,
): CourseStatus {
  const owns = course.priceAmount === null || activeEnrollment !== undefined;
  if (!owns) return "locked";
  if (completion && completion.completionPercent >= 100) return "completed";
  if (completion && completion.completionPercent > 0) return "in-progress";
  return "not-started";
}

/**
 * Joins the public catalog list with the caller's own enrollment, progress,
 * and recommendation data. No single endpoint returns "all catalog courses
 * annotated with my status" — this hook performs that join client-side over
 * one fetch of each source (never per-course calls).
 *
 * The catalog list itself is the only fetch that can fail the page; the
 * personalization sources (enrollments/completion/recommendations/recently
 * viewed) degrade silently to "no data" on failure so browsing never breaks
 * because a secondary signal is unavailable.
 */
export function useCatalogData() {
  const learningApi = useLearningApi();
  const commerceApi = useCommerceApi();
  const analyticsApi = useAnalyticsApi();
  const recommendationsApi = useRecommendationsApi();

  const [state, setState] = React.useState<State>({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    async function load() {
      let coursesRes;
      try {
        coursesRes = await learningApi.listCourses();
      } catch {
        if (!cancelled) setState({ status: "error" });
        return;
      }

      const [enrollmentsRes, completionRes, recommendationsRes, dashboardRes] =
        await Promise.allSettled([
          commerceApi.listMyEnrollments(),
          analyticsApi.getCourseCompletion(),
          recommendationsApi.getRecommendedCourses(),
          learningApi.getDashboard(),
        ]);
      if (cancelled) return;

      const activeEnrollmentByCourse = new Map<string, Enrollment>();
      if (enrollmentsRes.status === "fulfilled") {
        for (const e of enrollmentsRes.value.items) {
          if (e.status === "ACTIVE") activeEnrollmentByCourse.set(e.courseId, e);
        }
      }

      const completionByCourse = new Map<string, CourseCompletionEntry>();
      if (completionRes.status === "fulfilled") {
        for (const c of completionRes.value) completionByCourse.set(c.courseId, c);
      }

      const reasonByCourse = new Map<string, string>();
      if (recommendationsRes.status === "fulfilled") {
        for (const r of recommendationsRes.value) reasonByCourse.set(r.courseId, r.reason);
      }

      const recentMap = new Map<string, string>();
      if (dashboardRes.status === "fulfilled") {
        for (const lesson of dashboardRes.value.recentlyViewed) {
          const existing = recentMap.get(lesson.courseId);
          if (!existing || lesson.lastViewedAt > existing) {
            recentMap.set(lesson.courseId, lesson.lastViewedAt);
          }
        }
      }

      const enriched: EnrichedCourse[] = coursesRes.items.map((course) => {
        const completion = completionByCourse.get(course.id);
        return {
          course,
          status: deriveStatus(course, activeEnrollmentByCourse.get(course.id), completion),
          completionPercent: completion?.completionPercent ?? null,
          recommendedReason: reasonByCourse.get(course.id) ?? null,
          recentlyViewedAt: recentMap.get(course.id) ?? null,
        };
      });

      setState({ status: "ready", courses: enriched });
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return {
    ...state,
    retry: () => setAttempt((a) => a + 1),
  };
}
