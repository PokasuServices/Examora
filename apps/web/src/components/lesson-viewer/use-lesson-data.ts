"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { Curriculum, CourseProgress, LessonWithProgress } from "@examora/types";
import { useLearningApi } from "@/lib/learning-api";
import { flattenLessons, locateLesson } from "./flatten-curriculum";
import type { LessonAccessState } from "./types";

/**
 * Fetches the lesson itself (per lessonId) plus the course's curriculum and
 * progress (once per courseId, shared across lesson navigations) — the same
 * two calls the Course Details page already makes, reused here for
 * breadcrumb, module-progress, prev/next, and the course-navigation sidebar.
 * A 403 from either call means "locked" (not enrolled); anything else means
 * "not-found" — the same distinction already established on Course Details.
 */
export function useLessonData(courseId: string, lessonId: string) {
  const api = useLearningApi();

  const [curriculum, setCurriculum] = React.useState<Curriculum | null>(null);
  const [courseProgress, setCourseProgress] = React.useState<CourseProgress | null>(null);
  const [lesson, setLesson] = React.useState<LessonWithProgress | null>(null);
  const [access, setAccess] = React.useState<LessonAccessState>("checking");
  const [completing, setCompleting] = React.useState(false);

  // Course-scoped data: fetched once per course, not per lesson.
  React.useEffect(() => {
    let cancelled = false;
    Promise.all([api.getCurriculum(courseId), api.getCourseProgress(courseId)])
      .then(([c, p]) => {
        if (cancelled) return;
        setCurriculum(c);
        setCourseProgress(p);
      })
      .catch((err) => {
        if (cancelled) return;
        setAccess(err instanceof ApiError && err.status === 403 ? "locked" : "not-found");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Lesson-scoped data: refetched every time the student navigates to a new lesson.
  React.useEffect(() => {
    let cancelled = false;
    setLesson(null);
    api
      .getLesson(lessonId)
      .then((l) => {
        if (cancelled) return;
        setLesson(l);
        setAccess("granted");
        void api.recordView(lessonId).catch(() => undefined);
      })
      .catch((err) => {
        if (cancelled) return;
        setAccess(err instanceof ApiError && err.status === 403 ? "locked" : "not-found");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function markComplete(): Promise<void> {
    if (!lesson || lesson.completed) return;
    setCompleting(true);
    try {
      await api.completeLesson(lessonId);
      setLesson((l) => (l ? { ...l, completed: true } : l));
      // Same optimistic-patch approach for the sticky course-progress bar —
      // real numbers derived from the already-known total, not a refetch.
      setCourseProgress((p) => {
        if (!p) return p;
        const completedLessons = p.completedLessons + 1;
        return {
          ...p,
          completedLessons,
          percentComplete:
            p.totalLessons > 0 ? Math.round((completedLessons / p.totalLessons) * 100) : 0,
        };
      });
      // Patch the already-fetched curriculum so module-progress and the
      // course-nav sidebar reflect completion immediately, without a refetch.
      setCurriculum((c) =>
        c
          ? {
              ...c,
              subjects: c.subjects.map((s) => ({
                ...s,
                topics: s.topics.map((t) => ({
                  ...t,
                  modules: t.modules.map((m) => ({
                    ...m,
                    lessons: m.lessons.map((l) =>
                      l.id === lessonId ? { ...l, completed: true } : l,
                    ),
                  })),
                })),
              })),
            }
          : c,
      );
    } finally {
      setCompleting(false);
    }
  }

  const location = curriculum ? locateLesson(curriculum, lessonId) : null;
  const flatLessons = curriculum ? flattenLessons(curriculum) : [];
  const currentIndex = flatLessons.findIndex((l) => l.lessonId === lessonId);
  const previousLesson = currentIndex > 0 ? (flatLessons[currentIndex - 1] ?? null) : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < flatLessons.length - 1
      ? (flatLessons[currentIndex + 1] ?? null)
      : null;

  return {
    access,
    lesson,
    curriculum,
    courseProgress,
    location,
    previousLesson,
    nextLesson,
    completing,
    markComplete,
  };
}
