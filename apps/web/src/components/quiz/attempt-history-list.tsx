import Link from "next/link";
import type { AttemptHistoryItem } from "@examora/types";
import { Chip } from "@/components/ui/chip";

export function AttemptHistoryList({ history }: { history: AttemptHistoryItem[] }) {
  const finished = history.filter((h) => h.status !== "IN_PROGRESS");
  if (finished.length === 0) return null;

  return (
    <section aria-labelledby="attempt-history-heading">
      <h2
        id="attempt-history-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Your attempts
      </h2>
      <ul className="mt-3 flex flex-col divide-y divide-neutral-100 overflow-hidden rounded-card border border-neutral-900/[0.06] bg-white shadow-soft">
        {finished.map((h) => (
          <li key={h.id}>
            <Link
              href={`/quizzes/attempts/${h.id}/result`}
              className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
            >
              <span className="text-neutral-600">
                {new Date(h.startedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium tabular-nums text-neutral-800">{h.percentage}%</span>
                <Chip tone={h.passed ? "success" : "danger"}>
                  {h.passed ? "Passed" : "Not passed"}
                </Chip>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
