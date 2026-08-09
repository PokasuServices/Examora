"use client";

import * as React from "react";
import type {
  AdminAssignmentAnalytics,
  AdminCommunityAnalytics,
  AdminCoursePerformanceEntry,
  AdminNotificationDeliveryAnalytics,
  AdminPlatformDashboard,
  AdminQuizAnalytics,
  AdminRevenueAnalytics,
  AdminUserGrowthAnalytics,
  CommunityReport,
  OrderDetail,
  RefundSummary,
} from "@examora/types";
import { useAdminAnalyticsApi } from "@/lib/admin-analytics-api";
import { useAdminDashboardApi, type HealthCheckResult } from "@/lib/admin-dashboard-api";
import { ADMIN_ORIGIN } from "./admin-links";

type Status = "loading" | "ready" | "error";

export interface MonthlyRevenuePoint {
  month: string;
  amount: number;
  [key: string]: unknown;
}

export type ActivityEventKind = "order" | "refund" | "report";

export interface ActivityEvent {
  kind: ActivityEventKind;
  id: string;
  title: string;
  detail: string;
  at: string;
  href: string;
}

function bucketByMonth(
  revenueByDay: Array<{ date: string; amount: number }>,
): MonthlyRevenuePoint[] {
  const buckets = new Map<string, number>();
  for (const point of revenueByDay) {
    const d = new Date(point.date);
    const key = d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    buckets.set(key, (buckets.get(key) ?? 0) + point.amount);
  }
  return Array.from(buckets.entries()).map(([month, amount]) => ({
    month,
    amount: Math.round(amount),
  }));
}

/** Real growth signal derived from the actual daily registration series — never a fabricated percentage. */
function computeGrowthPercent(
  newUsersByDay: Array<{ date: string; count: number }>,
): number | null {
  if (newUsersByDay.length < 4) return null;
  const half = Math.floor(newUsersByDay.length / 2);
  const earlier = newUsersByDay.slice(0, half).reduce((sum, p) => sum + p.count, 0);
  const recent = newUsersByDay.slice(half).reduce((sum, p) => sum + p.count, 0);
  if (earlier === 0) return recent > 0 ? 100 : 0;
  return Math.round(((recent - earlier) / earlier) * 100);
}

function buildRecentActivity(
  orders: OrderDetail[],
  refunds: RefundSummary[],
  reports: CommunityReport[],
  adminOrigin: string,
): ActivityEvent[] {
  const events: ActivityEvent[] = [
    ...orders.map((o) => ({
      kind: "order" as const,
      id: o.id,
      title: `New order · ${o.courseTitle}`,
      detail: `${o.status} — ${o.userEmail}`,
      at: o.createdAt,
      href: `${adminOrigin}/commerce/orders/${o.id}`,
    })),
    ...refunds.map((r) => ({
      kind: "refund" as const,
      id: r.id,
      title: "Refund requested",
      detail: `${r.requestedByEmail} — ${r.reason}`,
      at: r.requestedAt,
      href: `${adminOrigin}/commerce/refunds`,
    })),
    ...reports.map((r) => ({
      kind: "report" as const,
      id: r.id,
      title: `Content reported (${r.targetType.toLowerCase()})`,
      detail: `${r.reporterEmail} — ${r.reason}`,
      at: r.createdAt,
      href: `${adminOrigin}/community/moderation`,
    })),
  ];
  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8);
}

/**
 * Fetches every real, already-existing admin data source this dashboard
 * needs in parallel. Nothing here is a new endpoint — see admin-analytics-api.ts
 * and admin-dashboard-api.ts for the underlying calls.
 */
export function useAdminDashboard() {
  const analyticsApi = useAdminAnalyticsApi();
  const dashboardApi = useAdminDashboardApi();

  const [status, setStatus] = React.useState<Status>("loading");
  const [platform, setPlatform] = React.useState<AdminPlatformDashboard | null>(null);
  const [userGrowth, setUserGrowth] = React.useState<AdminUserGrowthAnalytics | null>(null);
  const [revenue, setRevenue] = React.useState<AdminRevenueAnalytics | null>(null);
  const [coursePerformance, setCoursePerformance] = React.useState<AdminCoursePerformanceEntry[]>(
    [],
  );
  const [assignments, setAssignments] = React.useState<AdminAssignmentAnalytics | null>(null);
  const [quizzes, setQuizzes] = React.useState<AdminQuizAnalytics | null>(null);
  const [community, setCommunity] = React.useState<AdminCommunityAnalytics | null>(null);
  const [notifications, setNotifications] =
    React.useState<AdminNotificationDeliveryAnalytics | null>(null);
  const [health, setHealth] = React.useState<HealthCheckResult | null>(null);
  const [recentOrders, setRecentOrders] = React.useState<OrderDetail[]>([]);
  const [refundQueue, setRefundQueue] = React.useState<RefundSummary[]>([]);
  const [moderationQueue, setModerationQueue] = React.useState<CommunityReport[]>([]);
  const [templateCount, setTemplateCount] = React.useState(0);

  const load = React.useCallback(() => {
    setStatus("loading");
    Promise.all([
      analyticsApi.getPlatformDashboard(),
      analyticsApi.getUserGrowth(30),
      analyticsApi.getRevenueAnalytics(180),
      analyticsApi.getCoursePerformance(),
      analyticsApi.getAssignmentAnalytics(),
      analyticsApi.getQuizAnalytics(),
      analyticsApi.getCommunityAnalytics(30),
      analyticsApi.getNotificationDeliveryAnalytics(),
      dashboardApi.getHealth(),
      dashboardApi.listRecentOrders(6),
      dashboardApi.listRefundQueue("REQUESTED", 6),
      dashboardApi.listModerationQueue("PENDING", 6),
      dashboardApi.listTemplates(1),
    ])
      .then(
        ([
          platformRes,
          userGrowthRes,
          revenueRes,
          coursePerformanceRes,
          assignmentsRes,
          quizzesRes,
          communityRes,
          notificationsRes,
          healthRes,
          recentOrdersRes,
          refundQueueRes,
          moderationQueueRes,
          templatesRes,
        ]) => {
          setPlatform(platformRes);
          setUserGrowth(userGrowthRes);
          setRevenue(revenueRes);
          setCoursePerformance(coursePerformanceRes);
          setAssignments(assignmentsRes);
          setQuizzes(quizzesRes);
          setCommunity(communityRes);
          setNotifications(notificationsRes);
          setHealth(healthRes);
          setRecentOrders(recentOrdersRes.items);
          setRefundQueue(refundQueueRes.items);
          setModerationQueue(moderationQueueRes.items);
          setTemplateCount(templatesRes.total);
          setStatus("ready");
        },
      )
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const monthlyRevenue = React.useMemo(
    () => (revenue ? bucketByMonth(revenue.revenueByDay) : []),
    [revenue],
  );
  const growthPercent = React.useMemo(
    () => (userGrowth ? computeGrowthPercent(userGrowth.newUsersByDay) : null),
    [userGrowth],
  );
  const recentActivity = React.useMemo(
    () => buildRecentActivity(recentOrders, refundQueue, moderationQueue, ADMIN_ORIGIN),
    [recentOrders, refundQueue, moderationQueue],
  );

  return {
    status,
    platform,
    userGrowth,
    revenue,
    monthlyRevenue,
    growthPercent,
    coursePerformance,
    assignments,
    quizzes,
    community,
    notifications,
    health,
    recentOrders,
    refundQueue,
    moderationQueue,
    templateCount,
    recentActivity,
    retry: load,
  };
}
