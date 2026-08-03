"use client";

import * as React from "react";
import type { AssignmentSummary } from "@examora/types";
import { useAssignmentApi } from "@/lib/assignment-api";

export interface UpcomingAssignment extends AssignmentSummary {
  deadline: string;
}

export type FetchState<T> =
  { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

/**
 * Assignments with a set deadline, soonest first. No due-date concept exists
 * for quizzes anywhere in the platform, and mentor meetings are a past-tense
 * log a student can't query — so "upcoming activities" is assignments only
 * (see the Sprint 13 API survey this implementation is grounded in). Also
 * not enrollment-scoped: `listAssignments()` returns every published
 * assignment platform-wide, not just ones for the student's own courses.
 */
export function useUpcomingAssignments(): FetchState<UpcomingAssignment[]> & { retry: () => void } {
  const api = useAssignmentApi();
  const [state, setState] = React.useState<FetchState<UpcomingAssignment[]>>({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    setState({ status: "loading" });
    api
      .listAssignments()
      .then((res) => {
        const withDeadline = res.items
          .filter((a): a is UpcomingAssignment => a.deadline !== null)
          .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
        setState({ status: "ready", data: withDeadline });
      })
      .catch(() => setState({ status: "error" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) } as FetchState<UpcomingAssignment[]> & {
    retry: () => void;
  };
}
