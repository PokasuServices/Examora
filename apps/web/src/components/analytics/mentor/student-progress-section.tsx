import Link from "next/link";
import type { MentorStudentProgressEntry } from "@examora/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { timeAgo } from "@/lib/format";

export function StudentProgressSection({ entries }: { entries: MentorStudentProgressEntry[] }) {
  return (
    <section aria-labelledby="mentor-student-progress-heading">
      <h2
        id="mentor-student-progress-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Student Progress
      </h2>
      <Card className="mt-3" density="compact">
        {entries.length === 0 ? (
          <EmptyState heading="No assigned students yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Completion</th>
                  <th className="px-3 py-2">Quiz Avg</th>
                  <th className="px-3 py-2">Assignment Avg</th>
                  <th className="px-3 py-2">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {entries.map((e) => (
                  <tr key={e.studentId} className="hover:bg-neutral-50">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/mentor/students/${e.studentId}`}
                        className="font-medium text-neutral-800 hover:text-primary-600 hover:underline"
                      >
                        {e.studentName ?? e.studentEmail}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">
                      {e.overallCompletionPercent}%
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">
                      {e.quizAverage !== null ? `${e.quizAverage}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">
                      {e.assignmentAverage !== null ? `${e.assignmentAverage}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-neutral-500">
                      {e.lastActiveAt ? timeAgo(e.lastActiveAt) : "Never"}
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
