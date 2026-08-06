"use client";

import * as React from "react";
import type {
  AdminAssignmentAnalytics,
  AdminCommunityAnalytics,
  AdminCoursePerformanceEntry,
  AdminEnrollmentAnalytics,
  AdminMentorPerformanceEntry,
  AdminNotificationDeliveryAnalytics,
  AdminPlatformDashboard,
  AdminQuizAnalytics,
  AdminRevenueAnalytics,
  AdminUserGrowthAnalytics,
} from "@examora/types";
import { useAdminAnalyticsApi } from "@/lib/admin-analytics-api";

type Status = "loading" | "ready" | "error";
export const DAY_RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

/**
 * Platform/course/mentor/assignment/quiz/notification dashboards load once
 * — they have no date-range concept server-side. User growth, enrollment,
 * revenue, and community are the only four endpoints that accept `days`
 * (confirmed against DaysQueryDto on the admin controller), so only those
 * four refetch when the shared date-range control changes.
 */
export function useAdminAnalytics() {
  const api = useAdminAnalyticsApi();
  const [days, setDays] = React.useState(30);

  const [staticStatus, setStaticStatus] = React.useState<Status>("loading");
  const [platform, setPlatform] = React.useState<AdminPlatformDashboard | null>(null);
  const [coursePerformance, setCoursePerformance] = React.useState<AdminCoursePerformanceEntry[]>(
    [],
  );
  const [mentorPerformance, setMentorPerformance] = React.useState<AdminMentorPerformanceEntry[]>(
    [],
  );
  const [assignments, setAssignments] = React.useState<AdminAssignmentAnalytics | null>(null);
  const [quizzes, setQuizzes] = React.useState<AdminQuizAnalytics | null>(null);
  const [notifications, setNotifications] =
    React.useState<AdminNotificationDeliveryAnalytics | null>(null);

  const [rangedStatus, setRangedStatus] = React.useState<Status>("loading");
  const [userGrowth, setUserGrowth] = React.useState<AdminUserGrowthAnalytics | null>(null);
  const [enrollment, setEnrollment] = React.useState<AdminEnrollmentAnalytics | null>(null);
  const [revenue, setRevenue] = React.useState<AdminRevenueAnalytics | null>(null);
  const [community, setCommunity] = React.useState<AdminCommunityAnalytics | null>(null);

  const loadStatic = React.useCallback(() => {
    setStaticStatus("loading");
    Promise.all([
      api.getPlatformDashboard(),
      api.getCoursePerformance(),
      api.getMentorPerformance(),
      api.getAssignmentAnalytics(),
      api.getQuizAnalytics(),
      api.getNotificationDeliveryAnalytics(),
    ])
      .then(([p, cp, mp, a, q, n]) => {
        setPlatform(p);
        setCoursePerformance(cp);
        setMentorPerformance(mp);
        setAssignments(a);
        setQuizzes(q);
        setNotifications(n);
        setStaticStatus("ready");
      })
      .catch(() => setStaticStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRanged = React.useCallback(() => {
    setRangedStatus("loading");
    Promise.all([
      api.getUserGrowth(days),
      api.getEnrollmentAnalytics(days),
      api.getRevenueAnalytics(days),
      api.getCommunityAnalytics(days),
    ])
      .then(([ug, en, rv, cm]) => {
        setUserGrowth(ug);
        setEnrollment(en);
        setRevenue(rv);
        setCommunity(cm);
        setRangedStatus("ready");
      })
      .catch(() => setRangedStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  React.useEffect(() => {
    loadStatic();
  }, [loadStatic]);

  React.useEffect(() => {
    loadRanged();
  }, [loadRanged]);

  return {
    staticStatus,
    rangedStatus,
    days,
    setDays,
    platform,
    coursePerformance,
    mentorPerformance,
    assignments,
    quizzes,
    notifications,
    userGrowth,
    enrollment,
    revenue,
    community,
    retryStatic: loadStatic,
    retryRanged: loadRanged,
  };
}
