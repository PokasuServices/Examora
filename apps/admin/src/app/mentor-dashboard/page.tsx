"use client";

import * as React from "react";
import Link from "next/link";
import type { MentorDashboard } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { useMentorApi } from "@/lib/mentor-api";

function MentorDashboardContent() {
  const api = useMentorApi();
  const [dashboard, setDashboard] = React.useState<MentorDashboard | null>(null);

  React.useEffect(() => {
    api
      .getMentorDashboard()
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
      <h1 className="text-heading">My mentor dashboard</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {dashboard.assignedStudents.length} / {dashboard.profile.maxStudents} students ·{" "}
        {dashboard.pendingTaskCount} pending task{dashboard.pendingTaskCount === 1 ? "" : "s"}
      </p>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">My students</h2>
        {dashboard.assignedStudents.length > 0 ? (
          <ul className="mt-3 divide-y divide-neutral-100">
            {dashboard.assignedStudents.map((s) => (
              <li key={s.studentId} className="flex items-center justify-between py-2 text-sm">
                <Link
                  href={`/students/${s.studentId}`}
                  className="text-primary-600 hover:underline"
                >
                  {s.studentEmail}
                </Link>
                <span className="text-neutral-400">
                  since {new Date(s.assignedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No students assigned to you yet.</p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Upcoming tasks</h2>
        {dashboard.upcomingTasks.length > 0 ? (
          <ul className="mt-3 divide-y divide-neutral-100">
            {dashboard.upcomingTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {t.title}{" "}
                  {t.dueDate ? (
                    <span className="text-neutral-400">
                      (due {new Date(t.dueDate).toLocaleDateString()})
                    </span>
                  ) : null}
                </span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{t.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No pending tasks.</p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Recent meetings</h2>
        {dashboard.recentMeetings.length > 0 ? (
          <ul className="mt-3 divide-y divide-neutral-100">
            {dashboard.recentMeetings.map((m) => (
              <li key={m.id} className="py-2 text-sm">
                <p>{new Date(m.occurredAt).toLocaleString()}</p>
                {m.summary ? <p className="text-neutral-500">{m.summary}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No meetings logged yet.</p>
        )}
      </section>
    </main>
  );
}

export default function MentorDashboardPage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <MentorDashboardContent />
    </RequirePermission>
  );
}
