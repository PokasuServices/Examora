import type { LearnSubjectCard } from "@examora/types";
import { Card } from "@/components/ui/card";

/**
 * How much of each subject is done, as labelled horizontal bars (one series,
 * so no legend; each bar carries its own value).
 */
export function CoverageChart({ subjects }: { subjects: LearnSubjectCard[] }) {
  const overall =
    subjects.length === 0
      ? 0
      : Math.round(subjects.reduce((sum, s) => sum + s.percent, 0) / subjects.length);

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">
          Course coverage
        </h2>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          <strong className="font-semibold text-neutral-800 dark:text-white/90">{overall}%</strong>{" "}
          on average
        </span>
      </div>
      {subjects.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">No subjects yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {subjects.map((s) => (
            <li
              key={s.id}
              className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-3 text-sm"
            >
              <span className="truncate text-neutral-700 dark:text-neutral-300" title={s.title}>
                {s.title}
              </span>
              <span
                className="h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10"
                role="img"
                aria-label={`${s.title}: ${s.percent}% complete`}
              >
                <span
                  className="block h-full rounded-full bg-primary-600"
                  style={{ width: `${s.percent}%` }}
                />
              </span>
              <span className="text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                {s.percent}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
