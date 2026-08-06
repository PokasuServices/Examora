import type { AdminMentorPerformanceEntry } from "@examora/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function MentorPerformanceSection({ entries }: { entries: AdminMentorPerformanceEntry[] }) {
  return (
    <section aria-labelledby="admin-mentor-performance-heading">
      <h2
        id="admin-mentor-performance-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Mentor Performance
      </h2>
      <Card className="mt-3" density="compact">
        {entries.length === 0 ? (
          <EmptyState heading="No mentors with active caseloads yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-3 py-2">Mentor</th>
                  <th className="px-3 py-2">Active Students</th>
                  <th className="px-3 py-2">Avg. Student Completion</th>
                  <th className="px-3 py-2">Pending Reviews</th>
                  <th className="px-3 py-2">Avg. Turnaround</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {entries.map((m) => (
                  <tr key={m.mentorId} className="hover:bg-neutral-50">
                    <td className="px-3 py-2.5 font-medium text-neutral-800">{m.mentorEmail}</td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">
                      {m.activeStudentCount}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">
                      {m.averageStudentCompletionPercent}%
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">
                      {m.pendingReviewCount}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">
                      {m.averageReviewTurnaroundHours !== null
                        ? `${m.averageReviewTurnaroundHours}h`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
