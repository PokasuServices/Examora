"use client";

import * as React from "react";
import type { Curriculum, CourseRecommendation, SimilarCourseRecommendation } from "@examora/types";
import { useQuizApi } from "@/lib/quiz-api";
import { useAssignmentApi } from "@/lib/assignment-api";
import { useRecommendationsApi } from "@/lib/recommendations-api";
import type { SubjectStats } from "./types";

type ListState<T> = { status: "loading" | "error" | "ready"; items: T[] };

const EMPTY: ListState<never> = { status: "loading", items: [] };

/**
 * Non-blocking supplementary data — quiz/assignment counts per subject,
 * related courses, and general recommendations. None of this gates the
 * page: a failure here degrades to "section omitted," never a page error,
 * since the course itself is already viewable without it.
 */
export function useCourseExtras(courseId: string, curriculum: Curriculum | null) {
  const quizApi = useQuizApi();
  const assignmentApi = useAssignmentApi();
  const recommendationsApi = useRecommendationsApi();

  const [subjectStats, setSubjectStats] = React.useState<Map<string, SubjectStats> | null>(null);
  const [related, setRelated] = React.useState<ListState<SimilarCourseRecommendation>>(EMPTY);
  const [recommended, setRecommended] = React.useState<ListState<CourseRecommendation>>(EMPTY);

  React.useEffect(() => {
    if (!curriculum) return;
    let cancelled = false;

    Promise.allSettled([quizApi.listQuizzes(), assignmentApi.listAssignments()]).then(
      ([quizzesRes, assignmentsRes]) => {
        if (cancelled) return;
        const quizCountBySubject = new Map<string, number>();
        if (quizzesRes.status === "fulfilled") {
          for (const q of quizzesRes.value.items) {
            if (!q.subjectId) continue;
            quizCountBySubject.set(q.subjectId, (quizCountBySubject.get(q.subjectId) ?? 0) + 1);
          }
        }
        const assignmentCountBySubject = new Map<string, number>();
        if (assignmentsRes.status === "fulfilled") {
          for (const a of assignmentsRes.value.items) {
            if (!a.subjectId) continue;
            assignmentCountBySubject.set(
              a.subjectId,
              (assignmentCountBySubject.get(a.subjectId) ?? 0) + 1,
            );
          }
        }

        const stats = new Map<string, SubjectStats>();
        for (const subject of curriculum.subjects) {
          const lessons = subject.topics.flatMap((t) => t.modules).flatMap((m) => m.lessons);
          stats.set(subject.id, {
            subjectId: subject.id,
            totalLessons: lessons.length,
            completedLessons: lessons.filter((l) => l.completed).length,
            quizCount: quizCountBySubject.get(subject.id) ?? 0,
            assignmentCount: assignmentCountBySubject.get(subject.id) ?? 0,
          });
        }
        setSubjectStats(stats);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [curriculum, quizApi, assignmentApi]);

  React.useEffect(() => {
    let cancelled = false;
    setRelated({ status: "loading", items: [] });
    recommendationsApi
      .getSimilarCourses(courseId)
      .then((items) => !cancelled && setRelated({ status: "ready", items }))
      .catch(() => !cancelled && setRelated({ status: "error", items: [] }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  React.useEffect(() => {
    let cancelled = false;
    setRecommended({ status: "loading", items: [] });
    recommendationsApi
      .getRecommendedCourses()
      .then(
        (items) =>
          !cancelled &&
          setRecommended({ status: "ready", items: items.filter((r) => r.courseId !== courseId) }),
      )
      .catch(() => !cancelled && setRecommended({ status: "error", items: [] }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  return { subjectStats, related, recommended };
}
