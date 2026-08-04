"use client";

import * as React from "react";
import type { AssignmentDetail, SubmissionHistoryItem } from "@examora/types";
import { useAssignmentApi } from "@/lib/assignment-api";

type State =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "ready"; assignment: AssignmentDetail; history: SubmissionHistoryItem[] };

export function useAssignmentLanding(assignmentId: string) {
  const api = useAssignmentApi();
  const [state, setState] = React.useState<State>({ status: "loading" });
  const [starting, setStarting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    Promise.all([
      api.getAssignment(assignmentId),
      api.listHistory(assignmentId).catch(() => ({ items: [] })),
    ]).then(
      ([assignment, historyRes]) => {
        if (cancelled) return;
        setState({
          status: "ready",
          assignment,
          history: [...historyRes.items].sort((a, b) => b.version - a.version),
        });
      },
      () => {
        if (!cancelled) setState({ status: "not-found" });
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  /**
   * Idempotent start/resume (ADR-0015): no submission yet -> new v1 DRAFT;
   * latest is DRAFT -> resumes it; latest is REVISION_REQUESTED -> creates
   * the next version; otherwise returns the latest read-only. One call
   * covers Start / Resume / View — the backend already decides which.
   */
  async function startOrResume(): Promise<string> {
    setStarting(true);
    try {
      const submission = await api.startSubmission(assignmentId);
      return submission.id;
    } finally {
      setStarting(false);
    }
  }

  return { ...state, starting, startOrResume };
}
