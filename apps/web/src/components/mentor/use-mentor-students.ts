"use client";

import * as React from "react";
import { useMentorApi } from "@/lib/mentor-api";
import { activityBucket, type ActivityBucket } from "./activity-status";

export interface MergedStudent {
  studentId: string;
  name: string;
  email: string;
  assignedAt: string;
  overallCompletionPercent: number;
  quizAverage: number | null;
  assignmentAverage: number | null;
  lastActiveAt: string | null;
  bucket: ActivityBucket;
}

type State = { status: "loading" | "error" | "ready"; students: MergedStudent[] };

/**
 * /mentor/students (identity + assignedAt) and /analytics/mentor/
 * student-progress (completion/quiz/assignment/lastActive) are two separate
 * endpoints with no combined view — merged here client-side by studentId,
 * both scoped to the caller's own caseload so this never over-fetches.
 */
export function useMentorStudents() {
  const api = useMentorApi();
  const [state, setState] = React.useState<State>({ status: "loading", students: [] });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ status: "loading", students: prev.students }));
    Promise.all([api.listMyStudents(), api.getStudentProgress()]).then(
      ([students, progress]) => {
        if (cancelled) return;
        const progressById = new Map(progress.map((p) => [p.studentId, p]));
        const merged: MergedStudent[] = students.map((s) => {
          const p = progressById.get(s.studentId);
          return {
            studentId: s.studentId,
            name: [s.firstName, s.lastName].filter(Boolean).join(" ").trim() || s.studentEmail,
            email: s.studentEmail,
            assignedAt: s.assignedAt,
            overallCompletionPercent: p?.overallCompletionPercent ?? 0,
            quizAverage: p?.quizAverage ?? null,
            assignmentAverage: p?.assignmentAverage ?? null,
            lastActiveAt: p?.lastActiveAt ?? null,
            bucket: activityBucket(p?.lastActiveAt ?? null),
          };
        });
        setState({ status: "ready", students: merged });
      },
      () => {
        if (!cancelled) setState({ status: "error", students: [] });
      },
    );
    return () => {
      cancelled = true;
    };
    // api (useMentorApi()) is a fresh object every render, not memoized —
    // depending on it here would reproduce the exact infinite-loop bug fixed
    // in use-course-extras.ts. Only `attempt` (a real, deliberate trigger)
    // belongs in this array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}
