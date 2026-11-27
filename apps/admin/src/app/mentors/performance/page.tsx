"use client";

import * as React from "react";
import type { MentorWorkloadView } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { Pill, ToneCard } from "@/components/desk-ui";
import { useDeskApi } from "@/lib/desk-api";

function hours(h: number | null) {
  if (h === null) return "—";
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

function PerformanceContent() {
  const api = useDeskApi();
  const [rows, setRows] = React.useState<MentorWorkloadView[] | null>(null);
  const [error, setError] = React.useState(false);
  const load = React.useCallback(() => {
    setError(false);
    api
      .performance()
      .then(setRows)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => load(), [load]);
  const busiest = Math.max(1, ...(rows ?? []).map((r) => r.pendingReviews));
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Mentor performance"
        subtitle="Workload and responsiveness for every mentor over the last 30 days."
      />
      {error ? (
        <RetryInline message="Couldn't load mentors" onRetry={load} />
      ) : !rows ? (
        <Card className="text-sm text-neutral-500">Loading…</Card>
      ) : (
        <Card density="compact" className="overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-white/[0.03]">
              <tr>
                <th className="px-3 py-2 font-medium">Mentor</th>
                <th className="px-3 py-2 font-medium">Batches</th>
                <th className="px-3 py-2 font-medium">Students</th>
                <th className="px-3 py-2 font-medium">Classes / week</th>
                <th className="px-3 py-2 font-medium">Attendance pending</th>
                <th className="px-3 py-2 font-medium">Waiting to mark</th>
                <th className="px-3 py-2 font-medium">Marking time</th>
                <th className="px-3 py-2 font-medium">Doubt replies</th>
                <th className="px-3 py-2 font-medium">Reports</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.mentor.id}
                  className="border-t border-neutral-100 dark:border-neutral-800"
                >
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.mentor.name}</p>
                    <p className="text-xs text-neutral-500">{r.mentor.email}</p>
                  </td>
                  <td className="px-3 py-2">{r.batches}</td>
                  <td className="px-3 py-2">{r.students}</td>
                  <td className="px-3 py-2">{r.classesPerWeek}</td>
                  <td className="px-3 py-2">
                    {r.attendancePending ? <Pill tone="amber">{r.attendancePending}</Pill> : "0"}
                  </td>
                  <td className="min-w-[9rem] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-violet-500/80"
                          style={{ width: `${(r.pendingReviews / busiest) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs">{r.pendingReviews}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">{hours(r.avgTurnaroundHours)}</td>
                  <td className="px-3 py-2">
                    {r.doubtsAnswered30}{" "}
                    <span className="text-xs text-neutral-500">
                      ({hours(r.avgDoubtResponseHours)})
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.reportsSubmitted30}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <ToneCard tone="slate" className="p-4 text-xs text-neutral-500">
        Marking time is from upload to marks; doubt replies count answers in the last 30 days, with
        the average wait in brackets.
      </ToneCard>
    </main>
  );
}

export default function MentorPerformancePage() {
  return (
    <RequirePermission permission="mentor:manage">
      <PerformanceContent />
    </RequirePermission>
  );
}
