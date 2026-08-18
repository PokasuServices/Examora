"use client";

import * as React from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { useAuth } from "@examora/auth-client";
import type { AdminCourseProgress, PaginatedData } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";

function ProgressContent() {
  const { request } = useAuth();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [rows, setRows] = React.useState<AdminCourseProgress[]>([]);

  const load = React.useCallback(() => {
    setStatus("loading");
    request<PaginatedData<AdminCourseProgress>>("/admin/progress/courses?pageSize=100", {
      method: "GET",
    })
      .then((res) => {
        setRows(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Course progress"
        subtitle="Read-only learner and completion aggregates."
        actions={
          <Link
            href="/content/courses"
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            Manage content →
          </Link>
        }
      />

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load course progress" onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            heading="No published courses"
            body="Progress data appears here once courses are published."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Course
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Lessons
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Learners
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Completed course
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Total completions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((row) => (
                  <tr key={row.courseId} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">{row.courseTitle}</td>
                    <td className="px-4 py-3 text-neutral-600">{row.totalPublishedLessons}</td>
                    <td className="px-4 py-3 text-neutral-600">{row.learnerCount}</td>
                    <td className="px-4 py-3 text-neutral-600">{row.completedLearnerCount}</td>
                    <td className="px-4 py-3 text-neutral-600">{row.totalLessonCompletions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
