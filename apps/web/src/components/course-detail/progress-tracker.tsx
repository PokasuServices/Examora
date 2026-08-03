import type { Curriculum } from "@examora/types";
import { Card } from "@/components/ui/card";
import type { SubjectStats } from "./types";

/** Per-subject completion rollup — real, computed from the curriculum's own per-lesson `completed` flags. */
export function ProgressTracker({
  curriculum,
  subjectStats,
}: {
  curriculum: Curriculum;
  subjectStats: Map<string, SubjectStats> | null;
}) {
  if (!subjectStats) return null;

  return (
    <section aria-labelledby="progress-tracker-heading">
      <h2
        id="progress-tracker-heading"
        className="font-heading text-xl font-semibold text-neutral-900"
      >
        Progress tracker
      </h2>
      <Card className="mt-4">
        <ul className="flex flex-col divide-y divide-neutral-100">
          {curriculum.subjects.map((subject) => {
            const stats = subjectStats.get(subject.id);
            const percent =
              stats && stats.totalLessons > 0
                ? Math.round((stats.completedLessons / stats.totalLessons) * 100)
                : 0;
            return (
              <li key={subject.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <p className="min-w-0 flex-1 truncate text-sm text-neutral-700">{subject.title}</p>
                <div className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full bg-primary-600"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-neutral-500">
                  {percent}%
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
