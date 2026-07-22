"use client";

import * as React from "react";
import Link from "next/link";
import type { MentorWorkload } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { useMentorApi } from "@/lib/mentor-api";

function AdminMentorDashboardContent() {
  const api = useMentorApi();
  const [summary, setSummary] = React.useState<{
    totalMentors: number;
    totalActiveAssignments: number;
    mentors: MentorWorkload[];
  } | null>(null);

  React.useEffect(() => {
    api
      .getAdminMentorDashboard()
      .then(setSummary)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Mentor workload dashboard</h1>
        <Link href="/mentors" className="text-sm text-primary-600 hover:underline">
          Mentors →
        </Link>
      </div>

      {summary ? (
        <section className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-neutral-200 bg-white p-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-neutral-500">Total mentors</p>
            <p className="text-lg font-semibold">{summary.totalMentors}</p>
          </div>
          <div>
            <p className="text-neutral-500">Total active assignments</p>
            <p className="text-lg font-semibold">{summary.totalActiveAssignments}</p>
          </div>
        </section>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Mentor</th>
              <th className="px-4 py-3 font-medium">Active students</th>
              <th className="px-4 py-3 font-medium">Capacity</th>
              <th className="px-4 py-3 font-medium">Utilization</th>
            </tr>
          </thead>
          <tbody>
            {(summary?.mentors ?? []).map((m) => (
              <tr key={m.mentorId} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">{m.mentorEmail}</td>
                <td className="px-4 py-3">{m.activeStudentCount}</td>
                <td className="px-4 py-3">{m.maxStudents}</td>
                <td className="px-4 py-3">
                  {m.maxStudents > 0
                    ? `${Math.round((m.activeStudentCount / m.maxStudents) * 100)}%`
                    : "—"}
                </td>
              </tr>
            ))}
            {summary && summary.mentors.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                  No mentors yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function AdminMentorDashboardPage() {
  return (
    <RequirePermission permission="mentor:manage">
      <AdminMentorDashboardContent />
    </RequirePermission>
  );
}
