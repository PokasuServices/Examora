import Link from "next/link";
import type { AdminCoursePerformanceEntry } from "@examora/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function CoursePerformanceSection({ entries }: { entries: AdminCoursePerformanceEntry[] }) {
  return (
    <section aria-labelledby="admin-course-performance-heading">
      <h2
        id="admin-course-performance-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Course Performance
      </h2>
      <Card className="mt-3" density="compact">
        {entries.length === 0 ? (
          <EmptyState heading="No published courses yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-3 py-2">Course</th>
                  <th className="px-3 py-2">Enrollments</th>
                  <th className="px-3 py-2">Avg. Completion</th>
                  <th className="px-3 py-2">Avg. Quiz Score</th>
                  <th className="px-3 py-2">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {entries.map((c) => (
                  <tr key={c.courseId} className="hover:bg-neutral-50">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/courses/${c.courseId}`}
                        className="font-medium text-neutral-800 hover:text-primary-600 hover:underline"
                      >
                        {c.courseTitle}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">
                      {c.enrollmentCount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">
                      {c.averageCompletionPercent}%
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">
                      {c.averageQuizPercentage !== null ? `${c.averageQuizPercentage}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">
                      {c.revenue.toLocaleString()}
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
