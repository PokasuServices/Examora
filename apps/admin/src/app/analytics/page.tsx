"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { AnalyticsNav } from "@/components/analytics-nav";
import { RequirePermission } from "@/components/require-permission";
import { useAdminAnalyticsApi } from "@/lib/analytics-api";

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function AdminAnalyticsContent() {
  const api = useAdminAnalyticsApi();
  const [loading, setLoading] = React.useState(true);
  const [platform, setPlatform] = React.useState<AdminPlatformDashboard | null>(null);
  const [userGrowth, setUserGrowth] = React.useState<AdminUserGrowthAnalytics | null>(null);
  const [enrollment, setEnrollment] = React.useState<AdminEnrollmentAnalytics | null>(null);
  const [revenue, setRevenue] = React.useState<AdminRevenueAnalytics | null>(null);
  const [courses, setCourses] = React.useState<AdminCoursePerformanceEntry[]>([]);
  const [mentors, setMentors] = React.useState<AdminMentorPerformanceEntry[]>([]);
  const [assignments, setAssignments] = React.useState<AdminAssignmentAnalytics | null>(null);
  const [quizzes, setQuizzes] = React.useState<AdminQuizAnalytics | null>(null);
  const [community, setCommunity] = React.useState<AdminCommunityAnalytics | null>(null);
  const [notifications, setNotifications] =
    React.useState<AdminNotificationDeliveryAnalytics | null>(null);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getPlatformDashboard(),
      api.getUserGrowth(30),
      api.getEnrollmentAnalytics(30),
      api.getRevenueAnalytics(30),
      api.getCoursePerformance(),
      api.getMentorPerformance(),
      api.getAssignmentAnalytics(),
      api.getQuizAnalytics(),
      api.getCommunityAnalytics(30),
      api.getNotificationDeliveryAnalytics(),
    ])
      .then(([p, ug, e, r, c, m, a, q, com, n]) => {
        setPlatform(p);
        setUserGrowth(ug);
        setEnrollment(e);
        setRevenue(r);
        setCourses(c);
        setMentors(m);
        setAssignments(a);
        setQuizzes(q);
        setCommunity(com);
        setNotifications(n);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <AnalyticsNav />
      <h1 className="text-heading">Platform analytics</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Cross-platform KPIs, growth, revenue, and performance across every module.
      </p>

      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}

      {!loading && platform ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total users" value={platform.totalUsers} />
          <StatCard label="Students" value={platform.totalStudents} />
          <StatCard label="Mentors" value={platform.totalMentors} />
          <StatCard label="Published courses" value={platform.publishedCourseCount} />
          <StatCard label="Total enrollments" value={platform.totalEnrollments} />
          <StatCard label="Active enrollments" value={platform.activeEnrollments} />
          <StatCard
            label="Total revenue"
            value={`${platform.revenueCurrency} ${platform.totalRevenue.toLocaleString()}`}
          />
          <StatCard label="Total courses" value={platform.totalCourses} />
        </div>
      ) : null}

      {!loading && userGrowth && userGrowth.newUsersByDay.length > 0 ? (
        <Section title="New users (last 30 days)">
          <div className="h-56 rounded-lg border border-neutral-200 bg-white p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userGrowth.newUsersByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {userGrowth.usersByRole.map((r) => (
              <span
                key={r.role}
                className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700"
              >
                {r.role}: {r.count}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {!loading && revenue ? (
        <Section title="Revenue (last 30 days)">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Total revenue"
              value={`${revenue.currency} ${revenue.totalRevenue.toLocaleString()}`}
            />
            <StatCard label="Orders paid" value={revenue.ordersPaid} />
            <StatCard
              label="Avg. order value"
              value={`${revenue.currency} ${revenue.averageOrderValue.toFixed(2)}`}
            />
            <StatCard label="Coupon redemptions" value={revenue.couponRedemptions} />
          </div>
          {revenue.revenueByDay.length > 0 ? (
            <div className="mt-3 h-56 rounded-lg border border-neutral-200 bg-white p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </Section>
      ) : null}

      {!loading && enrollment ? (
        <Section title="Enrollment">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total" value={enrollment.totalEnrollments} />
            <StatCard label="Active" value={enrollment.activeEnrollments} />
            <StatCard label="Expired" value={enrollment.expiredEnrollments} />
            <StatCard label="Revoked" value={enrollment.revokedEnrollments} />
          </div>
        </Section>
      ) : null}

      {!loading && courses.length > 0 ? (
        <Section title="Course performance">
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Enrollments</th>
                  <th className="px-4 py-3 font-medium">Avg. completion</th>
                  <th className="px-4 py-3 font-medium">Avg. quiz</th>
                  <th className="px-4 py-3 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.courseId} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 text-neutral-800">{c.courseTitle}</td>
                    <td className="px-4 py-3 text-neutral-600">{c.enrollmentCount}</td>
                    <td className="px-4 py-3 text-neutral-600">{c.averageCompletionPercent}%</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {c.averageQuizPercentage !== null ? `${c.averageQuizPercentage}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{c.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {!loading && mentors.length > 0 ? (
        <Section title="Mentor performance">
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Mentor</th>
                  <th className="px-4 py-3 font-medium">Active students</th>
                  <th className="px-4 py-3 font-medium">Avg. student completion</th>
                  <th className="px-4 py-3 font-medium">Pending reviews</th>
                  <th className="px-4 py-3 font-medium">Avg. turnaround</th>
                </tr>
              </thead>
              <tbody>
                {mentors.map((m) => (
                  <tr key={m.mentorId} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 text-neutral-800">{m.mentorEmail}</td>
                    <td className="px-4 py-3 text-neutral-600">{m.activeStudentCount}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {m.averageStudentCompletionPercent}%
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{m.pendingReviewCount}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {m.averageReviewTurnaroundHours !== null
                        ? `${m.averageReviewTurnaroundHours}h`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {!loading && (assignments || quizzes) ? (
        <Section title="Assignment & quiz analytics">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total assignments" value={assignments?.totalAssignments ?? "—"} />
            <StatCard label="Submissions" value={assignments?.totalSubmissions ?? "—"} />
            <StatCard label="Pending review" value={assignments?.pendingReviewCount ?? "—"} />
            <StatCard
              label="Avg. marks"
              value={
                assignments?.averageMarksPercent !== null && assignments
                  ? `${assignments.averageMarksPercent}%`
                  : "—"
              }
            />
            <StatCard label="Total quizzes" value={quizzes?.totalQuizzes ?? "—"} />
            <StatCard label="Total attempts" value={quizzes?.totalAttempts ?? "—"} />
            <StatCard
              label="Avg. quiz score"
              value={
                quizzes?.averagePercentage !== null && quizzes
                  ? `${quizzes.averagePercentage}%`
                  : "—"
              }
            />
            <StatCard
              label="Pass rate"
              value={quizzes?.passRate !== null && quizzes ? `${quizzes.passRate}%` : "—"}
            />
          </div>
        </Section>
      ) : null}

      {!loading && community ? (
        <Section title="Community">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Threads" value={community.totalThreads} />
            <StatCard label="Replies" value={community.totalReplies} />
            <StatCard
              label="Accepted answer rate"
              value={
                community.acceptedAnswerRate !== null ? `${community.acceptedAnswerRate}%` : "—"
              }
            />
            <StatCard label="Open reports" value={community.openReportsCount} />
          </div>
        </Section>
      ) : null}

      {!loading && notifications ? (
        <Section title="Notification delivery">
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Queued</th>
                  <th className="px-4 py-3 font-medium">Delivered</th>
                  <th className="px-4 py-3 font-medium">Failed</th>
                  <th className="px-4 py-3 font-medium">Suppressed</th>
                  <th className="px-4 py-3 font-medium">Success rate</th>
                </tr>
              </thead>
              <tbody>
                {notifications.deliveryByChannel.map((c) => (
                  <tr key={c.channel} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 text-neutral-800">{c.channel}</td>
                    <td className="px-4 py-3 text-neutral-600">{c.queued}</td>
                    <td className="px-4 py-3 text-neutral-600">{c.delivered}</td>
                    <td className="px-4 py-3 text-neutral-600">{c.failed}</td>
                    <td className="px-4 py-3 text-neutral-600">{c.suppressed}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {c.successRate !== null ? `${c.successRate}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
    </main>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <RequirePermission permission="analytics:admin">
      <AdminAnalyticsContent />
    </RequirePermission>
  );
}
