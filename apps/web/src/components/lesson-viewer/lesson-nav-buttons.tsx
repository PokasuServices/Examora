import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@examora/ui";
import type { FlatLesson } from "./types";

export function LessonNavButtons({
  courseId,
  previousLesson,
  nextLesson,
  variant,
}: {
  courseId: string;
  previousLesson: FlatLesson | null;
  nextLesson: FlatLesson | null;
  variant: "compact" | "full";
}) {
  if (variant === "compact") {
    return (
      <div className="flex shrink-0 items-center gap-1">
        {previousLesson ? (
          <Link
            href={`/courses/${courseId}/lessons/${previousLesson.lessonId}`}
            aria-label={`Previous lesson: ${previousLesson.title}`}
            title={`Previous: ${previousLesson.title}`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center text-neutral-200">
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}
        {nextLesson ? (
          <Link
            href={`/courses/${courseId}/lessons/${nextLesson.lessonId}`}
            aria-label={`Next lesson: ${nextLesson.title}`}
            title={`Next: ${nextLesson.title}`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center text-neutral-200">
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {previousLesson ? (
        <Link
          href={`/courses/${courseId}/lessons/${previousLesson.lessonId}`}
          className="group flex items-center gap-3 rounded-card border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-soft transition-all hover:-translate-y-px hover:shadow-soft-hover"
        >
          <ChevronLeft
            size={20}
            strokeWidth={1.75}
            className="shrink-0 text-neutral-400 dark:text-neutral-500"
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="block text-xs text-neutral-400 dark:text-neutral-500">Previous</span>
            <span className="block truncate text-sm font-medium text-neutral-800 dark:text-white/90">
              {previousLesson.title}
            </span>
          </span>
        </Link>
      ) : (
        <div />
      )}
      {nextLesson ? (
        <Link
          href={`/courses/${courseId}/lessons/${nextLesson.lessonId}`}
          className={cn(
            "group flex items-center justify-end gap-3 rounded-card border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 text-right shadow-soft transition-all hover:-translate-y-px hover:shadow-soft-hover",
          )}
        >
          <span className="min-w-0">
            <span className="block text-xs text-neutral-400 dark:text-neutral-500">Next</span>
            <span className="block truncate text-sm font-medium text-neutral-800 dark:text-white/90">
              {nextLesson.title}
            </span>
          </span>
          <ChevronRight
            size={20}
            strokeWidth={1.75}
            className="shrink-0 text-neutral-400 dark:text-neutral-500"
            aria-hidden="true"
          />
        </Link>
      ) : null}
    </div>
  );
}
