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
import { Users } from "lucide-react";
import type {
  MentorAssignmentReviewStats,
  MentorEngagementSummary,
  MentorPerformanceTrendPoint,
  MentorQuizPerformanceSummary,
  MentorStudentProgressEntry,
  MentorWorkloadSummary,
} from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { StatCardSkeleton } from "@/components/ui/skeleton";
import { useMentorAnalyticsApi } from "@/lib/analytics-api";

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card density="compact">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-base font-semibold text-neutral-900">{title}</h2>
      {children}
    </section>
  );
}

function MentorAnalyticsContent() {
  const api = useMentorAnalyticsApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [students, setStudents] = React.useState<MentorStudentProgressEntry[]>([]);
  const [trends, setTrends] = React.useState<MentorPerformanceTrendPoint[]>([]);
  const [quiz, setQuiz] = React.useState<MentorQuizPerformanceSummary | null>(null);
  const [reviewStats, setReviewStats] = React.useState<MentorAssignmentReviewStats | null>(null);
  const [workload, setWorkload] = React.useState<MentorWorkloadSummary | null>(null);
  const [engagement, setEngagement] = React.useState<MentorEngagementSummary | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
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
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const trendData = trends.map((t) => ({
    week: t.weekStart.slice(5, 10),
    quiz: t.averageQuizPercentage ?? 0,
    assignment: t.averageAssignmentPercentage ?? 0,
  }));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="My mentee analytics"
        subtitle="Progress, performance, and engagement across your assigned students."
      />

      {status === "error" ? (
        <Card>
          <RetryInline message="Couldn't load mentor analytics" onRetry={load} />
        </Card>
      ) : status === "loading" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <>
          {workload ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Active students" value={workload.activeStudentCount} />
              <StatCard label="Max students" value={workload.maxStudents} />
              <StatCard label="Utilization" value={`${workload.utilizationPercent}%`} />
              <StatCard label="Pending tasks" value={workload.pendingTasksCount} />
            </div>
          ) : null}

          {quiz || reviewStats ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Avg. quiz score"
                value={
                  quiz?.averagePercentage !== null && quiz ? `${quiz.averagePercentage}%` : "—"
                }
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

          {engagement ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Active last 7 days" value={engagement.studentsActiveLast7Days} />
              <StatCard label="Inactive 14+ days" value={engagement.studentsInactive14Days} />
              <StatCard label="Total students" value={engagement.totalStudents} />
            </div>
          ) : null}

          {trendData.length > 0 ? (
            <Section title="8-week performance trend">
              <Card>
                <div className="h-64">
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
              </Card>
            </Section>
          ) : null}

          <Section title="Student progress">
            <Card density="compact" className="min-w-0">
              {students.length === 0 ? (
                <EmptyState icon={Users} heading="No assigned students yet" />
              ) : (
                <div className="overflow-x-auto contain-layout">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Student
                        </th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Completion
                        </th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Quiz avg
                        </th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Assignment avg
                        </th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Last active
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {students.map((s) => (
                        <tr key={s.studentId} className="hover:bg-neutral-50">
                          <td className="px-4 py-3 text-neutral-800">
                            {s.studentName ?? s.studentEmail}
                          </td>
                          <td className="px-4 py-3 text-neutral-600">
                            {s.overallCompletionPercent}%
                          </td>
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
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </Section>
        </>
      )}
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
