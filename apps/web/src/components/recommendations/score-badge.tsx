import { cn } from "@examora/ui";

/** "92% match" pill — the same real 0-100 `score` every recommendation DTO already carries. */
export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700",
        className,
      )}
    >
      {score}% match
    </span>
  );
}
