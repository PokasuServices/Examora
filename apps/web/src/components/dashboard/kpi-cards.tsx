"use client";

import * as React from "react";
import { Award, CalendarClock, Flame, TrendingUp } from "lucide-react";
import { useAnalyticsApi } from "@/lib/analytics-api";
import { StatCard, StatCardErrorTile, StatCardSkeletonTile } from "./stat-card";
import { useUpcomingAssignments } from "./use-upcoming-assignments";
import { SCOPE_WINDOW_MS, type DashboardScope } from "./scope";

type Loadable<T> = { status: "loading" | "error" | "ready"; data: T | null };

function useLoadable<T>(fetcher: () => Promise<T>): Loadable<T> & { retry: () => void } {
  const [state, setState] = React.useState<Loadable<T>>({ status: "loading", data: null });
  const [attempt, setAttempt] = React.useState(0);
  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;

  React.useEffect(() => {
    setState({ status: "loading", data: null });
    fetcherRef
      .current()
      .then((data) => setState({ status: "ready", data }))
      .catch(() => setState({ status: "error", data: null }));
  }, [attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}

/** Four independent widgets, each with its own fetch/retry — one metric failing never blocks the other three. */
export function KpiCards({ scope }: { scope: DashboardScope }) {
  const analyticsApi = useAnalyticsApi();
  const progress = useLoadable(() => analyticsApi.getProgress());
  const activity = useLoadable(() => analyticsApi.getActivity());
  const quizPerformance = useLoadable(() => analyticsApi.getQuizPerformance());
  const assignments = useUpcomingAssignments();

  const dueCount =
    assignments.status === "ready"
      ? assignments.data.filter(
          (a) => new Date(a.deadline).getTime() - Date.now() < SCOPE_WINDOW_MS[scope],
        ).length
      : null;
  const overdueCount =
    assignments.status === "ready"
      ? assignments.data.filter((a) => new Date(a.deadline).getTime() < Date.now()).length
      : 0;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {progress.status === "loading" ? (
        <StatCardSkeletonTile />
      ) : progress.status === "error" || !progress.data ? (
        <StatCardErrorTile label="Overall Progress" onRetry={progress.retry} />
      ) : (
        <StatCard
          icon={TrendingUp}
          tone="primary"
          label="Overall Progress"
          value={`${progress.data.overallCompletionPercent}%`}
          accessibleLabel={`Overall progress: ${progress.data.overallCompletionPercent} percent`}
        />
      )}

      {activity.status === "loading" ? (
        <StatCardSkeletonTile />
      ) : activity.status === "error" || !activity.data ? (
        <StatCardErrorTile label="Current Streak" onRetry={activity.retry} />
      ) : (
        <StatCard
          icon={Flame}
          tone="warning"
          label="Current Streak"
          value={activity.data.currentStreakDays > 0 ? `${activity.data.currentStreakDays}` : "0"}
          trend={
            activity.data.currentStreakDays === 0
              ? { direction: "flat", label: "Start today" }
              : undefined
          }
          accessibleLabel={`Current streak: ${activity.data.currentStreakDays} days`}
        />
      )}

      {quizPerformance.status === "loading" ? (
        <StatCardSkeletonTile />
      ) : quizPerformance.status === "error" || !quizPerformance.data ? (
        <StatCardErrorTile label="Avg. Quiz Score" onRetry={quizPerformance.retry} />
      ) : (
        <StatCard
          icon={Award}
          tone="success"
          label="Avg. Quiz Score"
          value={
            quizPerformance.data.averagePercentage !== null
              ? `${Math.round(quizPerformance.data.averagePercentage)}%`
              : "—"
          }
          accessibleLabel={
            quizPerformance.data.averagePercentage !== null
              ? `Average quiz score: ${Math.round(quizPerformance.data.averagePercentage)} percent`
              : "Average quiz score: no attempts yet"
          }
        />
      )}

      {assignments.status === "loading" ? (
        <StatCardSkeletonTile />
      ) : assignments.status === "error" ? (
        <StatCardErrorTile label="Due This Week" onRetry={assignments.retry} />
      ) : (
        <StatCard
          icon={CalendarClock}
          tone={overdueCount > 0 ? "danger" : "primary"}
          label="Due This Week"
          value={`${dueCount ?? 0}`}
          trend={
            overdueCount > 0 ? { direction: "down", label: `${overdueCount} overdue` } : undefined
          }
          accessibleLabel={`${dueCount ?? 0} assignments due this week${overdueCount > 0 ? `, ${overdueCount} overdue` : ""}`}
        />
      )}
    </div>
  );
}
