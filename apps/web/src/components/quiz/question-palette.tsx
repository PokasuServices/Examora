import { cn } from "@examora/ui";
import type { PaletteTone } from "./types";

const TONE_CLASS: Record<PaletteTone, string> = {
  current: "bg-primary-600 text-white",
  answered: "bg-primary-100 text-primary-700",
  unanswered: "bg-neutral-100 text-neutral-600",
  correct: "bg-success-500/10 text-success-700",
  wrong: "bg-danger-500/10 text-danger-700",
};

/** Question-jump navigator — reused by the Attempt screen (answered/unanswered) and the Review screen (correct/wrong). */
export function QuestionPalette({
  count,
  activeIndex,
  onSelect,
  getTone,
  labelPrefix = "Question",
}: {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  getTone: (index: number) => PaletteTone;
  labelPrefix?: string;
}) {
  return (
    <nav aria-label="Question navigator" className="flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`${labelPrefix} ${i + 1}`}
          aria-current={i === activeIndex ? "true" : undefined}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
            TONE_CLASS[i === activeIndex ? "current" : getTone(i)],
          )}
        >
          {i + 1}
        </button>
      ))}
    </nav>
  );
}
