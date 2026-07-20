"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@examora/auth-client";
import type { AdminCourseProgress, PaginatedData } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";

function ProgressContent() {
  const { request } = useAuth();
  const [rows, setRows] = React.useState<AdminCourseProgress[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    request<PaginatedData<AdminCourseProgress>>("/admin/progress/courses?pageSize=100", {
      method: "GET",
    })
      .then((res) => setRows(res.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [request]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Course progress</h1>
        <Link href="/content/courses" className="text-sm text-primary-600 hover:underline">
          Manage content →
        </Link>
      </div>
      <p className="mt-1 text-sm text-neutral-600">Read-only learner and completion aggregates.</p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Course</th>
              <th className="px-4 py-3 font-medium">Lessons</th>
              <th className="px-4 py-3 font-medium">Learners</th>
              <th className="px-4 py-3 font-medium">Completed course</th>
              <th className="px-4 py-3 font-medium">Total completions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.courseId} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3 font-medium">{row.courseTitle}</td>
                <td className="px-4 py-3">{row.totalPublishedLessons}</td>
                <td className="px-4 py-3">{row.learnerCount}</td>
                <td className="px-4 py-3">{row.completedLearnerCount}</td>
                <td className="px-4 py-3">{row.totalLessonCompletions}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No published courses.
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  Loading…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function AdminProgressPage() {
  return (
    <RequirePermission permission="progress:read">
      <ProgressContent />
    </RequirePermission>
  );
}
