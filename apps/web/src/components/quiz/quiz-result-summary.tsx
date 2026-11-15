import { cn } from "@examora/ui";
import type { AttemptResult } from "@examora/types";

export function QuizResultSummary({ result }: { result: AttemptResult }) {
  return (
    <div
      className={cn(
        "rounded-card border p-8 text-center shadow-soft",
        result.passed
          ? "border-success-500/30 bg-success-50 dark:bg-success-500/15"
          : "border-danger-500/30 bg-danger-50 dark:bg-danger-500/15",
      )}
    >
      <p className="font-heading text-5xl font-bold tabular-nums text-neutral-900 dark:text-white/90">
        {result.percentage}%
      </p>
      <p
        className={cn(
          "mt-2 text-lg font-semibold",
          result.passed
            ? "text-success-700 dark:text-success-300"
            : "text-danger-700 dark:text-danger-300",
        )}
      >
        {result.passed ? "Passed" : "Not passed"}
      </p>
      {result.status === "AUTO_SUBMITTED" ? (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Auto-submitted when time ran out.
        </p>
      ) : null}
    </div>
  );
}
