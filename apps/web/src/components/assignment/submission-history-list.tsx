import Link from "next/link";
import type { SubmissionHistoryItem } from "@examora/types";
import { SubmissionStatusChip } from "./submission-status-chip";

export function SubmissionHistoryList({ history }: { history: SubmissionHistoryItem[] }) {
  if (history.length === 0) return null;

  return (
    <section aria-labelledby="submission-history-heading">
      <h2
        id="submission-history-heading"
        className="text-lg font-medium text-neutral-800 dark:text-white/90"
      >
        Your submissions
      </h2>
      <ul className="mt-3 flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden rounded-card border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-soft">
        {history.map((h) => (
          <li key={h.id}>
            <Link
              href={`/assignments/submission/${h.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm hover:bg-neutral-50 dark:hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
            >
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                Version {h.version}
              </span>
              <span className="flex items-center gap-2">
                {h.obtainedMarks !== null ? (
                  <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                    {h.obtainedMarks} marks
                  </span>
                ) : null}
                <SubmissionStatusChip status={h.status} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
