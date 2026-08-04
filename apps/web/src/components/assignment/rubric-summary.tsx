import type { RubricCriterion } from "@examora/types";

/** Pre-submission rubric — real per-criterion point values (no weight field exists, only raw maxMarks). */
export function RubricSummary({ criteria }: { criteria: RubricCriterion[] }) {
  if (criteria.length === 0) return null;

  return (
    <section aria-labelledby="rubric-heading">
      <h2 id="rubric-heading" className="font-heading text-lg font-semibold text-neutral-900">
        Rubric
      </h2>
      <ul className="mt-3 flex flex-col divide-y divide-neutral-100 overflow-hidden rounded-card border border-neutral-900/[0.06] bg-white shadow-soft">
        {criteria.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-800">{c.title}</p>
              {c.description ? (
                <p className="mt-0.5 text-sm text-neutral-500">{c.description}</p>
              ) : null}
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums text-neutral-500">
              {c.maxMarks} {c.maxMarks === 1 ? "mark" : "marks"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
