import { Award, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { AttemptResult } from "@examora/types";
import { Card } from "@/components/ui/card";
import { formatClock } from "@/lib/format";

export function QuizResultStats({ result }: { result: AttemptResult }) {
  return (
    <Card>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <Award size={14} strokeWidth={1.75} aria-hidden="true" />
            Marks
          </div>
          <p className="mt-1 font-heading text-xl font-bold text-neutral-900 dark:text-white/90">
            {result.obtainedMarks} / {result.totalMarks}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true" />
            Correct
          </div>
          <p className="mt-1 font-heading text-xl font-bold text-success-600 dark:text-success-400">
            {result.correctCount}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <XCircle size={14} strokeWidth={1.75} aria-hidden="true" />
            Wrong
          </div>
          <p className="mt-1 font-heading text-xl font-bold text-danger-600 dark:text-danger-400">
            {result.wrongCount}
          </p>
        </div>
        <div>
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Unanswered
          </div>
          <p className="mt-1 font-heading text-xl font-bold text-neutral-500 dark:text-neutral-400">
            {result.unansweredCount}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
            Time spent
          </div>
          <p className="mt-1 font-heading text-xl font-bold text-neutral-900 dark:text-white/90">
            {formatClock(result.timeTakenSeconds)}
          </p>
        </div>
      </div>
    </Card>
  );
}
