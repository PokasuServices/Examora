import Link from "next/link";
import type { CourseCompletionEntry } from "@examora/types";
import { ChartCard } from "@/components/analytics/chart-card";
import { CategoryBarChart } from "@/components/analytics/charts";
import { EmptyState } from "@/components/ui/empty-state";

export function LearningProgressSection({ courses }: { courses: CourseCompletionEntry[] }) {
  const chartData = courses.map((c) => ({
    name: c.courseTitle.length > 16 ? `${c.courseTitle.slice(0, 16)}…` : c.courseTitle,
    completion: c.completionPercent,
  }));

  return (
    <section aria-labelledby="learning-progress-heading">
      <h2
        id="learning-progress-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Learning Progress
      </h2>
      <div className="mt-3">
        {courses.length === 0 ? (
          <EmptyState
            heading="No courses yet"
            body="Enroll in a course to start tracking your progress."
            actionLabel="Browse courses"
            actionHref="/courses"
          />
        ) : (
          <ChartCard
            title="Completion by course"
            subtitle="Percent of lessons completed, per enrolled course"
          >
            <CategoryBarChart
              data={chartData}
              nameKey="name"
              valueKey="completion"
              domain={[0, 100]}
              valueFormatter={(v) => `${v}%`}
            />
          </ChartCard>
        )}
      </div>
      {courses.length > 0 ? (
        <ul className="mt-3 flex flex-col divide-y divide-neutral-100 rounded-card border border-neutral-900/[0.06] bg-white shadow-soft">
          {courses.map((c) => (
            <li
              key={c.courseId}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <Link
                href={`/courses/${c.courseId}`}
                className="min-w-0 flex-1 truncate font-medium text-neutral-800 hover:text-primary-600 hover:underline"
              >
                {c.courseTitle}
              </Link>
              <span className="shrink-0 text-neutral-500">
                {c.completedLessons}/{c.totalLessons} lessons · {c.completionPercent}%
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
