"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type {
  AchievementSummary,
  ActivitySummary,
  AssignmentPerformanceSummary,
  CourseCompletionEntry,
  LearningProgressSummary,
  LearningTimelineEntry,
  QuizPerformanceSummary,
} from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { useAnalyticsApi } from "@/lib/analytics-api";

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

const TIMELINE_LABELS: Record<LearningTimelineEntry["type"], string> = {
  LESSON_COMPLETED: "Completed a lesson",
  QUIZ_SUBMITTED: "Submitted a quiz",
  ASSIGNMENT_SUBMITTED: "Submitted an assignment",
  ASSIGNMENT_REVIEWED: "Assignment reviewed",
  COURSE_ENROLLED: "Enrolled in a course",
};

function AnalyticsContent() {
  const api = useAnalyticsApi();
  const [loading, setLoading] = React.useState(true);
  const [progress, setProgress] = React.useState<LearningProgressSummary | null>(null);
  const [courses, setCourses] = React.useState<CourseCompletionEntry[]>([]);
  const [quiz, setQuiz] = React.useState<QuizPerformanceSummary | null>(null);
  const [assignments, setAssignments] = React.useState<AssignmentPerformanceSummary | null>(null);
  const [timeline, setTimeline] = React.useState<LearningTimelineEntry[]>([]);
  const [activity, setActivity] = React.useState<ActivitySummary | null>(null);
  const [achievements, setAchievements] = React.useState<AchievementSummary | null>(null);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getProgress(),
      api.getCourseCompletion(),
      api.getQuizPerformance(),
      api.getAssignmentPerformance(),
      api.getTimeline(20),
      api.getActivity(),
      api.getAchievements(),
    ])
      .then(([p, c, q, a, t, act, ach]) => {
        setProgress(p);
        setCourses(c);
        setQuiz(q);
        setAssignments(a);
        setTimeline(t);
        setActivity(act);
        setAchievements(ach);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartData = courses.map((c) => ({
    name: c.courseTitle.length > 18 ? `${c.courseTitle.slice(0, 18)}…` : c.courseTitle,
    completion: c.completionPercent,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-heading">My analytics</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Your learning progress, quiz and assignment performance, and recent activity.
      </p>

      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}

      {!loading && progress ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Enrolled courses" value={progress.enrolledCourseCount} />
          <StatCard label="Completed courses" value={progress.completedCourseCount} />
          <StatCard label="Lessons completed" value={progress.totalLessonsCompleted} />
          <StatCard label="Overall completion" value={`${progress.overallCompletionPercent}%`} />
        </div>
      ) : null}

      {!loading && activity ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Active days (7d)" value={activity.last7DaysActiveDays} />
          <StatCard label="Active days (30d)" value={activity.last30DaysActiveDays} />
          <StatCard label="Current streak" value={`${activity.currentStreakDays}d`} />
          <StatCard
            label="Last active"
            value={
              activity.lastActiveAt ? new Date(activity.lastActiveAt).toLocaleDateString() : "—"
            }
          />
        </div>
      ) : null}

      {!loading && courses.length > 0 ? (
        <Section title="Course completion">
          <div className="h-64 rounded-lg border border-neutral-200 bg-white p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Bar dataKey="completion" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      ) : null}

      {!loading && quiz ? (
        <Section title="Quiz performance">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Attempts submitted" value={quiz.attemptsSubmitted} />
            <StatCard
              label="Average score"
              value={quiz.averagePercentage !== null ? `${quiz.averagePercentage}%` : "—"}
            />
            <StatCard
              label="Best score"
              value={quiz.bestPercentage !== null ? `${quiz.bestPercentage}%` : "—"}
            />
            <StatCard
              label="Pass rate"
              value={quiz.passRate !== null ? `${quiz.passRate}%` : "—"}
            />
          </div>
          {quiz.recentAttempts.length > 0 ? (
            <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
              {quiz.recentAttempts.map((a) => (
                <li
                  key={a.attemptId}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="text-neutral-800">{a.quizTitle}</span>
                  <span className="text-neutral-500">
                    {a.percentage !== null ? `${a.percentage}%` : "—"}
                    {a.passed !== null ? (a.passed ? " · Passed" : " · Failed") : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}

      {!loading && assignments ? (
        <Section title="Assignment performance">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Submitted" value={assignments.submittedCount} />
            <StatCard label="Reviewed" value={assignments.reviewedCount} />
            <StatCard
              label="Average marks"
              value={
                assignments.averageMarksPercent !== null
                  ? `${assignments.averageMarksPercent}%`
                  : "—"
              }
            />
          </div>
          {assignments.recentReviews.length > 0 ? (
            <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
              {assignments.recentReviews.map((r) => (
                <li
                  key={r.submissionId}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="text-neutral-800">{r.assignmentTitle}</span>
                  <span className="text-neutral-500">
                    {r.obtainedMarks !== null ? `${r.obtainedMarks}/${r.marksTotal}` : "Pending"}
                    {r.decision ? ` · ${r.decision}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}

      {!loading && achievements ? (
        <Section title="Achievements">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Courses completed" value={achievements.coursesCompleted} />
            <StatCard label="Quizzes passed" value={achievements.quizzesPassed} />
            <StatCard label="Assignments approved" value={achievements.assignmentsApproved} />
            <StatCard label="Reputation points" value={achievements.reputationPoints} />
            <StatCard label="Accepted answers" value={achievements.communityAcceptedAnswers} />
          </div>
        </Section>
      ) : null}

      {!loading && timeline.length > 0 ? (
        <Section title="Recent activity">
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {timeline.map((entry, index) => (
              <li
                key={`${entry.occurredAt}-${index}`}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="text-neutral-800">
                  {TIMELINE_LABELS[entry.type]} — {entry.title}
                </span>
                <span className="text-neutral-400">
                  {new Date(entry.occurredAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </main>
  );
}

export default function AnalyticsPage() {
  return (
    <RequireAuth>
      <AnalyticsContent />
    </RequireAuth>
  );
}
