import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@examora/ui";
import { formatClock } from "@/lib/format";
import { AutosaveIndicator, type AutosaveStatus } from "@/components/ui/autosave-indicator";

/**
 * The Attempt screen's own minimal header — deliberately not the app's
 * persistent Sidebar/Header shell. "Clean distraction-free layout" is an
 * explicit requirement for this one screen (matching how Duolingo/Brilliant
 * hide all navigation chrome during an active exercise); every other quiz
 * screen (Landing/Result/Review) keeps the normal app shell.
 */
export function AttemptHeader({
  quizId,
  quizTitle,
  remainingSeconds,
  answeredCount,
  totalCount,
  autosaveStatus,
}: {
  quizId: string;
  quizTitle: string;
  remainingSeconds: number | null;
  answeredCount: number;
  totalCount: number;
  autosaveStatus: AutosaveStatus;
}) {
  const percent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-900/[0.06] bg-white">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 sm:px-6">
        <Link
          href={`/quizzes/${quizId}`}
          aria-label="Exit quiz"
          title="Exit quiz"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-700">{quizTitle}</p>
        <AutosaveIndicator status={autosaveStatus} />
        {remainingSeconds !== null ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-sm font-medium tabular-nums",
              remainingSeconds < 60
                ? "bg-danger-600 text-white"
                : "bg-neutral-100 text-neutral-700",
            )}
            aria-live="polite"
          >
            {formatClock(remainingSeconds)}
          </span>
        ) : null}
      </div>
      <div className="h-1 w-full bg-neutral-100">
        <div
          className="h-full bg-primary-600 transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-label="Questions answered"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </header>
  );
}
