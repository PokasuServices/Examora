import Link from "next/link";
import { ClipboardList } from "lucide-react";
import type { ReviewerQueueItem } from "@examora/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Read-only preview of the reviewer queue — scoring rubrics and publishing
 * decisions is a separate, substantial workspace (already built in
 * apps/admin's /assignments/reviewer/[id]) that isn't part of today's scope.
 * Each row links to the student's 360 view, the real destination this
 * workspace does own.
 */
export function PendingReviewsList({ items }: { items: ReviewerQueueItem[] }) {
  return (
    <section aria-labelledby="pending-reviews-heading">
      <h2
        id="pending-reviews-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Pending Assignment Reviews
      </h2>
      <Card className="mt-3">
        {items.length === 0 ? (
          <EmptyState icon={ClipboardList} heading="No pending reviews" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/mentor/students/${item.studentId}`}
                  className="flex items-center justify-between gap-3 rounded-md py-2.5 text-sm hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-neutral-800">
                      {item.assignmentTitle}
                    </span>
                    <span className="text-xs text-neutral-400">{item.studentEmail}</span>
                  </span>
                  {item.submittedAt ? (
                    <span className="shrink-0 text-xs text-neutral-400">
                      {new Date(item.submittedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
