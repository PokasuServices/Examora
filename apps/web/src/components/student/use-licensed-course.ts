"use client";

import * as React from "react";
import { useLearnApi } from "@/lib/learn-api";
import { useLoad } from "./use-load";

const COURSE_KEY = "examora:learn-course";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(COURSE_KEY);
  } catch {
    return null;
  }
}

function store(id: string): void {
  try {
    window.localStorage.setItem(COURSE_KEY, id);
  } catch {
    // Remembering the choice is a convenience only.
  }
}

/** The student's licensed courses and the selected one (remembered across Learn/Practice/Profile). */
export function useLicensedCourse() {
  const api = useLearnApi();
  const courses = useLoad(() => api.listCourses(), "licensed-courses");
  const [courseId, setCourseIdState] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!courses.data || courseId) return;
    const stored = readStored();
    const pick = courses.data.find((c) => c.id === stored) ?? courses.data[0];
    if (pick) setCourseIdState(pick.id);
  }, [courses.data, courseId]);

  const setCourseId = React.useCallback((id: string) => {
    setCourseIdState(id);
    store(id);
  }, []);

  return { courses, courseId, setCourseId };
}
