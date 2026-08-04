import type { CourseProgress } from "@examora/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen } from "lucide-react";

export function LearningProgressSection({ courses }: { courses: CourseProgress[] }) {
  return (
    <section aria-labelledby="learning-progress-heading">
      <h2
        id="learning-progress-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Learning Progress
      </h2>
      <Card className="mt-3">
        {courses.length === 0 ? (
          <EmptyState icon={BookOpen} heading="No courses in progress" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {courses.map((c) => (
              <li key={c.courseId} className="flex items-center gap-3 py-2.5">
                <p className="min-w-0 flex-1 truncate text-sm text-neutral-700">{c.courseTitle}</p>
                <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full bg-primary-600"
                    style={{ width: `${c.percentComplete}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-neutral-500">
                  {c.percentComplete}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
