import type { RubricScoreEntry } from "@examora/types";
import { Card } from "@/components/ui/card";

/** Per-criterion score — real published RubricScoreEntry rows, same thin-bar pattern used for progress everywhere else in the app. */
export function RubricBreakdown({ scores }: { scores: RubricScoreEntry[] }) {
  return (
    <Card>
      <h3 className="font-heading text-base font-semibold text-neutral-900">Rubric breakdown</h3>
      <ul className="mt-4 flex flex-col gap-4">
        {scores.map((s) => {
          const percent = s.maxMarks > 0 ? Math.round((s.marksAwarded / s.maxMarks) * 100) : 0;
          return (
            <li key={s.criterionId}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-neutral-800">{s.criterionTitle}</span>
                <span className="tabular-nums text-neutral-500">
                  {s.marksAwarded} / {s.maxMarks}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-primary-600"
                  style={{ width: `${percent}%` }}
                />
              </div>
              {s.comment ? <p className="mt-1.5 text-sm text-neutral-600">{s.comment}</p> : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
