import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { FlatLesson } from "./types";

/** Mark-complete control that becomes the page's own "Continue Learning" CTA once done — no separate widget needed. */
export function LessonCompleteBar({
  courseId,
  completed,
  completing,
  nextLesson,
  onMarkComplete,
}: {
  courseId: string;
  completed: boolean;
  completing: boolean;
  nextLesson: FlatLesson | null;
  onMarkComplete: () => void;
}) {
  if (!completed) {
    return (
      <button
        type="button"
        onClick={onMarkComplete}
        disabled={completing}
        className="flex h-11 items-center justify-center gap-2 rounded-md bg-primary-600 px-6 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
      >
        {completing ? "Saving…" : "Mark as complete"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="inline-flex items-center gap-2 text-sm font-medium text-success-700">
        <CheckCircle2 size={18} strokeWidth={2} aria-hidden="true" />
        Completed
      </span>
      {nextLesson ? (
        <Link
          href={`/courses/${courseId}/lessons/${nextLesson.lessonId}`}
          className="flex h-11 items-center justify-center rounded-md bg-primary-600 px-6 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Continue to next lesson
        </Link>
      ) : (
        <Link
          href={`/courses/${courseId}`}
          className="flex h-11 items-center justify-center rounded-md bg-success-50 px-6 text-sm font-medium text-success-700 hover:bg-success-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          🎉 You&rsquo;ve finished this course — back to overview
        </Link>
      )}
    </div>
  );
}
