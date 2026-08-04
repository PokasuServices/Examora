"use client";

import * as React from "react";
import type {
  MentorAssignmentReviewStats,
  MentorDashboard,
  MentorEngagementSummary,
  MentorStudentProgressEntry,
  ReviewerQueueItem,
} from "@examora/types";
import { useMentorApi } from "@/lib/mentor-api";

type State =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      dashboard: MentorDashboard;
      engagement: MentorEngagementSummary;
      reviewStats: MentorAssignmentReviewStats;
      pendingReviews: ReviewerQueueItem[];
      studentProgress: MentorStudentProgressEntry[];
    };

/**
 * Meetings This Week counts real logged MentorMeeting rows falling in the
 * current week — the closest honest stand-in for the requested "Meetings
 * Today" card. MentorMeeting is a retrospective log (occurredAt + summary,
 * "no calendar integration" per its own schema comment) — there is no
 * scheduling/future-meetings concept anywhere in the backend, so this counts
 * meetings already logged, not meetings booked ahead.
 */
export function meetingsThisWeekCount(dashboard: MentorDashboard): number {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - now.getDay());
  return dashboard.recentMeetings.filter((m) => new Date(m.occurredAt) >= startOfWeek).length;
}

export function useMentorDashboardData() {
  const api = useMentorApi();
  const [state, setState] = React.useState<State>({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    Promise.all([
      api.getDashboard(),
      api.getEngagement(),
      api.getAssignmentReviewStats(),
      api.getReviewQueue(5).then((r) => r.items),
      api.getStudentProgress(),
    ]).then(
      ([dashboard, engagement, reviewStats, pendingReviews, studentProgress]) => {
        if (cancelled) return;
        setState({
          status: "ready",
          dashboard,
          engagement,
          reviewStats,
          pendingReviews,
          studentProgress,
        });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}
