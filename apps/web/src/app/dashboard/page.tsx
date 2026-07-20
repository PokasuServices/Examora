"use client";

import * as React from "react";
import Link from "next/link";
import type { LearningDashboard } from "@examora/types";
import { ProgressBar } from "@/components/progress-bar";
import { RequireAuth } from "@/components/require-auth";
import { useLearningApi } from "@/lib/learning-api";

function DashboardContent() {
  const api = useLearningApi();
  const [dashboard, setDashboard] = React.useState<LearningDashboard | null>(null);

  React.useEffect(() => {
    api
      .getDashboard()
      .then(setDashboard)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dashboard) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">My learning</h1>
        <Link href="/courses" className="text-sm text-primary-600 hover:underline">
          Explore courses →
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatTile label="Courses started" value={dashboard.stats.coursesStarted} />
        <StatTile label="Courses completed" value={dashboard.stats.coursesCompleted} />
        <StatTile label="Lessons completed" value={dashboard.stats.lessonsCompleted} />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Continue learning</h2>
        {dashboard.continueLearning.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Nothing in progress.{" "}
            <Link href="/courses" className="text-primary-600 hover:underline">
              Browse courses
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {dashboard.continueLearning.map((course) => (
              <Link
                key={course.courseId}
                href={
                  course.nextLesson
                    ? `/courses/${course.courseId}/lessons/${course.nextLesson.id}`
                    : `/courses/${course.courseId}`
                }
                className="rounded-lg border border-neutral-200 bg-white p-4 hover:border-primary-400"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{course.courseTitle}</span>
                  <span className="text-sm text-neutral-500">{course.percentComplete}%</span>
                </div>
                <div className="mt-2">
                  <ProgressBar percent={course.percentComplete} />
                </div>
                {course.nextLesson ? (
                  <p className="mt-2 text-sm text-neutral-500">Next: {course.nextLesson.title}</p>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Recently viewed</h2>
        {dashboard.recentlyViewed.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No recent activity.</p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {dashboard.recentlyViewed.map((item) => (
              <li key={item.lessonId}>
                <Link
                  href={`/courses/${item.courseId}/lessons/${item.lessonId}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50"
                >
                  <span>
                    {item.lessonTitle}{" "}
                    <span className="text-neutral-400">· {item.courseTitle}</span>
                  </span>
                  {item.completed ? <span className="text-success-600">✓</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-neutral-500">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
