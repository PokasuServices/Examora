import { AlertTriangle, Calendar } from "lucide-react";
import { Chip } from "@/components/ui/chip";

/**
 * Deadline is purely advisory — SubmissionsService.submitFinal never checks
 * Assignment.deadline (confirmed: no reference to it anywhere in the submit
 * path). So this can honestly show "Overdue," but must never imply
 * submission is blocked, since it isn't.
 */
export function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) {
    return <Chip tone="neutral">No deadline</Chip>;
  }
  const isOverdue = new Date(deadline).getTime() < Date.now();
  const formatted = new Date(deadline).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Chip tone={isOverdue ? "warning" : "neutral"}>
      <span className="inline-flex items-center gap-1">
        {isOverdue ? (
          <AlertTriangle size={12} strokeWidth={2} aria-hidden="true" />
        ) : (
          <Calendar size={12} strokeWidth={2} aria-hidden="true" />
        )}
        {isOverdue ? `Overdue since ${formatted}` : `Due ${formatted}`}
      </span>
    </Chip>
  );
}
