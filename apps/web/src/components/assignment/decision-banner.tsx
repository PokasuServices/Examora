import { CheckCircle2, RotateCcw } from "lucide-react";
import { cn } from "@examora/ui";
import type { AssignmentReview } from "@examora/types";

export function DecisionBanner({
  review,
  marksTotal,
  onResubmit,
  resubmitting,
}: {
  review: AssignmentReview;
  /** Undefined only in the brief window before the parent assignment has loaded — don't show a misleading total until it has. */
  marksTotal: number | undefined;
  onResubmit: () => void;
  resubmitting: boolean;
}) {
  const approved = review.decision === "APPROVED";

  return (
    <div
      className={cn(
        "rounded-card border p-6 shadow-soft",
        approved ? "border-success-500/30 bg-success-50" : "border-warning-500/30 bg-warning-50",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            approved ? "bg-success-500/15 text-success-700" : "bg-warning-500/15 text-warning-700",
          )}
        >
          {approved ? (
            <CheckCircle2 size={20} strokeWidth={2} aria-hidden="true" />
          ) : (
            <RotateCcw size={20} strokeWidth={2} aria-hidden="true" />
          )}
        </span>
        <div>
          <p
            className={cn(
              "font-heading text-lg font-semibold",
              approved ? "text-success-800" : "text-warning-800",
            )}
          >
            {approved ? "Approved" : "Revision requested"}
          </p>
          {review.obtainedMarks !== null && marksTotal !== undefined ? (
            <p className="text-sm tabular-nums text-neutral-600">
              {review.obtainedMarks} / {marksTotal} marks
            </p>
          ) : null}
        </div>
      </div>

      {review.overallComment ? (
        <p className="mt-4 text-sm text-neutral-700">{review.overallComment}</p>
      ) : null}

      {!approved ? (
        <button
          type="button"
          disabled={resubmitting}
          onClick={onResubmit}
          className="mt-5 flex h-10 items-center justify-center rounded-md bg-primary-600 px-5 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
        >
          {resubmitting ? "Starting…" : "Start a revised submission"}
        </button>
      ) : null}
    </div>
  );
}
