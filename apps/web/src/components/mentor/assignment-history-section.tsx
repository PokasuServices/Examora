import type { SubmissionHistoryItem } from "@examora/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";
import { SubmissionStatusChip } from "@/components/assignment/submission-status-chip";

export function AssignmentHistorySection({ history }: { history: SubmissionHistoryItem[] }) {
  return (
    <section aria-labelledby="assignment-history-heading">
      <h2
        id="assignment-history-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Assignment Performance
      </h2>
      <Card className="mt-3">
        {history.length === 0 ? (
          <EmptyState icon={ClipboardList} heading="No assignment submissions yet" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {history.slice(0, 10).map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-neutral-700">
                  {h.assignmentTitle} <span className="text-neutral-400">v{h.version}</span>
                </span>
                {h.obtainedMarks !== null ? (
                  <span className="shrink-0 tabular-nums text-neutral-500">
                    {h.obtainedMarks} marks
                  </span>
                ) : null}
                <SubmissionStatusChip status={h.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
