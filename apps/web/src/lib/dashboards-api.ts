"use client";

import { useAuth } from "@examora/auth-client";
import type {
  CollegesDashboard,
  DashboardSeenKey,
  DiscussDashboard,
  PracticeDashboardSummary,
  RewardsDashboard,
  StudentAlertsSync,
} from "@examora/types";

/** Tab overviews (Practice, Discuss, Colleges, Rewards) and bell-alert sync. */
export function useDashboardsApi() {
  const { request } = useAuth();
  const get = <T>(path: string) => request<T>(path, { method: "GET" });
  return {
    practice: () => get<PracticeDashboardSummary>("/student-dashboards/practice"),
    discuss: () => get<DiscussDashboard>("/student-dashboards/discuss"),
    colleges: () => get<CollegesDashboard>("/student-dashboards/colleges"),
    rewards: () => get<RewardsDashboard>("/student-dashboards/rewards"),
    markSeen: (key: DashboardSeenKey) =>
      request<void>(`/student-dashboards/${key}/seen`, { method: "POST" }),
    syncAlerts: () =>
      request<StudentAlertsSync>("/student-dashboards/alerts/sync", { method: "POST" }),
  };
}
