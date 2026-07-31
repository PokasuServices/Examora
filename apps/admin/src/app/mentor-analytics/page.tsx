"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  MentorAssignmentReviewStats,
  MentorEngagementSummary,
  MentorPerformanceTrendPoint,
  MentorQuizPerformanceSummary,
  MentorStudentProgressEntry,
  MentorWorkloadSummary,
} from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { useMentorAnalyticsApi } from "@/lib/analytics-api";

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

function MentorAnalyticsContent() {
  const api = useMentorAnalyticsApi();
  const [loading, setLoading] = React.useState(true);
  const [students, setStudents] = React.useState<MentorStudentProgressEntry[]>([]);
  const [trends, setTrends] = React.useState<MentorPerformanceTrendPoint[]>([]);
  const [quiz, setQuiz] = React.useState<MentorQuizPerformanceSummary | null>(null);
  const [reviewStats, setReviewStats] = React.useState<MentorAssignmentReviewStats | null>(null);
  const [workload, setWorkload] = React.useState<MentorWorkloadSummary | null>(null);
  const [engagement, setEngagement] = React.useState<MentorEngagementSummary | null>(null);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getStudentProgress(),
      api.getPerformanceTrends(),
      api.getQuizPerformance(),
      api.getAssignmentReviewStats(),
      api.getWorkload(),
      api.getEngagement(),
    ])
      .then(([s, t, q, r, w, e]) => {
        setStudents(s);
        setTrends(t);
        setQuiz(q);
        setReviewStats(r);
        setWorkload(w);
        setEngagement(e);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trendData = trends.map((t) => ({
    week: t.weekStart.slice(5, 10),
    quiz: t.averageQuizPercentage ?? 0,
    assignment: t.averageAssignmentPercentage ?? 0,
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-heading">My mentee analytics</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Progress, performance, and engagement across your assigned students.
      </p>

      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}

      {!loading && workload ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Active students" value={workload.activeStudentCount} />
          <StatCard label="Max students" value={workload.maxStudents} />
          <StatCard label="Utilization" value={`${workload.utilizationPercent}%`} />
          <StatCard label="Pending tasks" value={workload.pendingTasksCount} />
        </div>
      ) : null}

      {!loading && (quiz || reviewStats) ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Avg. quiz score"
            value={quiz?.averagePercentage !== null && quiz ? `${quiz.averagePercentage}%` : "—"}
          />
          <StatCard
            label="Quiz pass rate"
            value={quiz?.passRate !== null && quiz ? `${quiz.passRate}%` : "—"}
          />
          <StatCard label="Pending reviews" value={reviewStats?.pendingReview ?? "—"} />
          <StatCard
            label="Avg. turnaround"
            value={
              reviewStats?.averageTurnaroundHours !== null && reviewStats
                ? `${reviewStats.averageTurnaroundHours}h`
                : "—"
            }
          />
        </div>
      ) : null}

      {!loading && engagement ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Active last 7 days" value={engagement.studentsActiveLast7Days} />
          <StatCard label="Inactive 14+ days" value={engagement.studentsInactive14Days} />
          <StatCard label="Total students" value={engagement.totalStudents} />
        </div>
      ) : null}

      {!loading && trendData.length > 0 ? (
        <Section title="8-week performance trend">
          <div className="h-64 rounded-lg border border-neutral-200 bg-white p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Line
                  type="monotone"
                  dataKey="quiz"
                  name="Quiz avg"
                  stroke="#4f46e5"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="assignment"
                  name="Assignment avg"
                  stroke="#059669"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      ) : null}

      {!loading ? (
        <Section title="Student progress">
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Completion</th>
                  <th className="px-4 py-3 font-medium">Quiz avg</th>
                  <th className="px-4 py-3 font-medium">Assignment avg</th>
                  <th className="px-4 py-3 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.studentId} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 text-neutral-800">
                      {s.studentName ?? s.studentEmail}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{s.overallCompletionPercent}%</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {s.quizAverage !== null ? `${s.quizAverage}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {s.assignmentAverage !== null ? `${s.assignmentAverage}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                      No assigned students yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
    </main>
  );
}

export default function MentorAnalyticsPage() {
  return (
    <RequirePermission permission="analytics:mentor">
      <MentorAnalyticsContent />
    </RequirePermission>
  );
}
