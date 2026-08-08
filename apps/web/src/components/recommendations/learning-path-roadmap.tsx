import Link from "next/link";
import { CheckCircle2, MapPin, Sparkles } from "lucide-react";
import type { ContinueLearningItem, CourseCompletionEntry, LearningPathStep } from "@examora/types";
import { cn } from "@examora/ui";
import { ScoreBadge } from "./score-badge";

function TimelineNode({
  tone,
  icon: Icon,
  isLast,
}: {
  tone: "done" | "current" | "next";
  icon: typeof CheckCircle2;
  isLast: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full ring-4",
          tone === "done" && "bg-success-500 text-white ring-success-50",
          tone === "current" && "bg-primary-600 text-white ring-primary-50",
          tone === "next" && "bg-white text-neutral-400 ring-neutral-100",
        )}
      >
        <Icon size={16} strokeWidth={2} aria-hidden="true" />
      </span>
      {!isLast ? (
        <span
          className={cn("mt-1 w-0.5 flex-1", tone === "done" ? "bg-success-200" : "bg-neutral-200")}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

/** Full vertical roadmap: completed milestones → current position → suggested next steps, in that order. */
export function LearningPathRoadmap({
  completed,
  current,
  next,
}: {
  completed: CourseCompletionEntry[];
  current: ContinueLearningItem[];
  next: LearningPathStep[];
}) {
  const totalRows = completed.length + current.length + next.length;
  let rowIndex = 0;

  return (
    <div className="flex flex-col">
      {completed.map((c) => {
        rowIndex += 1;
        return (
          <div key={`done-${c.courseId}`} className="flex gap-4">
            <TimelineNode tone="done" icon={CheckCircle2} isLast={rowIndex === totalRows} />
            <div className="min-w-0 flex-1 pb-6">
              <p className="text-xs font-medium uppercase tracking-wide text-success-600">
                Completed
              </p>
              <Link
                href={`/courses/${c.courseId}`}
                className="mt-0.5 block font-heading text-base font-semibold text-neutral-900 hover:text-primary-600 hover:underline"
              >
                {c.courseTitle}
              </Link>
              <p className="mt-0.5 text-sm text-neutral-500">
                {c.completedLessons}/{c.totalLessons} lessons · finished
              </p>
            </div>
          </div>
        );
      })}

      {current.map((c) => {
        rowIndex += 1;
        return (
          <div key={`current-${c.courseId}`} className="flex gap-4">
            <TimelineNode tone="current" icon={MapPin} isLast={rowIndex === totalRows} />
            <div className="min-w-0 flex-1 pb-6">
              <p className="text-xs font-medium uppercase tracking-wide text-primary-600">
                You are here
              </p>
              <Link
                href={
                  c.nextLesson
                    ? `/courses/${c.courseId}/lessons/${c.nextLesson.id}`
                    : `/courses/${c.courseId}`
                }
                className="mt-0.5 block font-heading text-base font-semibold text-neutral-900 hover:text-primary-600 hover:underline"
              >
                {c.courseTitle}
              </Link>
              <p className="mt-0.5 text-sm text-neutral-500">
                {c.completionPercent}% complete
                {c.nextLesson ? ` · Next: ${c.nextLesson.title}` : ""}
              </p>
            </div>
          </div>
        );
      })}

      {next.map((step) => {
        rowIndex += 1;
        return (
          <div key={`next-${step.courseId}`} className="flex gap-4">
            <TimelineNode tone="next" icon={Sparkles} isLast={rowIndex === totalRows} />
            <div className="min-w-0 flex-1 pb-6">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Next up · Step {step.order}
                </p>
                <ScoreBadge score={step.score} />
              </div>
              <Link
                href={`/courses/${step.courseId}`}
                className="mt-0.5 block font-heading text-base font-semibold text-neutral-900 hover:text-primary-600 hover:underline"
              >
                {step.courseTitle}
              </Link>
              <p className="mt-1 flex items-start gap-1.5 text-sm text-neutral-500">
                <Sparkles
                  size={13}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-accent-500"
                  aria-hidden="true"
                />
                {step.reason}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
