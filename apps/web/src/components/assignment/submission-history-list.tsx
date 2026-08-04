import Link from "next/link";
import type { SubmissionHistoryItem } from "@examora/types";
import { SubmissionStatusChip } from "./submission-status-chip";

export function SubmissionHistoryList({ history }: { history: SubmissionHistoryItem[] }) {
  if (history.length === 0) return null;

  return (
    <section aria-labelledby="submission-history-heading">
      <h2
        id="submission-history-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Your submissions
      </h2>
      <ul className="mt-3 flex flex-col divide-y divide-neutral-100 overflow-hidden rounded-card border border-neutral-900/[0.06] bg-white shadow-soft">
        {history.map((h) => (
          <li key={h.id}>
            <Link
              href={`/assignments/submission/${h.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
            >
              <span className="font-medium text-neutral-700">Version {h.version}</span>
              <span className="flex items-center gap-2">
                {h.obtainedMarks !== null ? (
                  <span className="tabular-nums text-neutral-500">{h.obtainedMarks} marks</span>
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
