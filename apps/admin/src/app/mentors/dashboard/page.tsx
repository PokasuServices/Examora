"use client";

import * as React from "react";
import Link from "next/link";
import { Gauge } from "lucide-react";
import type { MentorWorkload } from "@examora/types";
import { Button } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import { useMentorApi } from "@/lib/mentor-api";

interface DashboardSummary {
  totalMentors: number;
  totalActiveAssignments: number;
  mentors: MentorWorkload[];
}

function AdminMentorDashboardContent() {
  const api = useMentorApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .getAdminMentorDashboard()
      .then((res) => {
        setSummary(res);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Mentor workload dashboard"
        subtitle="Active caseload and capacity across every mentor."
        actions={
          <Link href="/mentors">
            <Button variant="secondary">Mentors</Button>
          </Link>
        }
      />

      {status === "error" ? (
        <Card>
          <RetryInline message="Couldn't load the workload dashboard" onRetry={load} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {status === "loading" ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <Card>
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Total mentors
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-white/90">
                    {summary?.totalMentors ?? 0}
                  </p>
                </Card>
                <Card>
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Total active assignments
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-white/90">
                    {summary?.totalActiveAssignments ?? 0}
                  </p>
                </Card>
              </>
            )}
          </div>

          <Card density="compact" className="min-w-0">
            {status === "loading" ? (
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (summary?.mentors.length ?? 0) === 0 ? (
              <EmptyState
                icon={Gauge}
                heading="No mentors yet"
                body="Create a mentor profile to see workload here."
              />
            ) : (
              <div className="overflow-x-auto contain-layout">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-neutral-50 dark:bg-white/[0.03]">
                    <tr>
                      <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Mentor
                      </th>
                      <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Active students
                      </th>
                      <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Capacity
                      </th>
                      <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Utilization
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {(summary?.mentors ?? []).map((m) => (
                      <tr
                        key={m.mentorId}
                        className="hover:bg-neutral-50 dark:hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-3 text-neutral-800 dark:text-white/90">
                          {m.mentorEmail}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                          {m.activeStudentCount}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                          {m.maxStudents}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                          {m.maxStudents > 0
                            ? `${Math.round((m.activeStudentCount / m.maxStudents) * 100)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
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
