import { AlertTriangle, Award, HelpCircle, Timer } from "lucide-react";
import type { QuizStudentDetail } from "@examora/types";
import { Card } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";

/**
 * Negative marking shows only the boolean flag — the exact per-wrong-answer
 * deduction (Quiz.negativeMarksPerWrong) is deliberately never sent to the
 * student-facing API (verified in assessment.mappers.ts's
 * toQuizStudentDetail — it reads negativeMarkingEnabled but never touches
 * negativeMarksPerWrong even though it's on the same row), so this UI can't
 * show a number that was never given to it.
 */
export function QuizMetaGrid({ quiz }: { quiz: QuizStudentDetail }) {
  const duration = quiz.timeLimitMinutes ? formatDuration(quiz.timeLimitMinutes) : null;

  return (
    <Card>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <HelpCircle size={14} strokeWidth={1.75} aria-hidden="true" />
            Questions
          </div>
          <p className="mt-1 font-heading text-xl font-bold text-neutral-900">
            {quiz.totalQuestions}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Award size={14} strokeWidth={1.75} aria-hidden="true" />
            Total marks
          </div>
          <p className="mt-1 font-heading text-xl font-bold text-neutral-900">{quiz.totalMarks}</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Timer size={14} strokeWidth={1.75} aria-hidden="true" />
            Time limit
          </div>
          <p className="mt-1 font-heading text-xl font-bold text-neutral-900">
            {duration ?? "Untimed"}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Award size={14} strokeWidth={1.75} aria-hidden="true" />
            Passing score
          </div>
          <p className="mt-1 font-heading text-xl font-bold text-neutral-900">
            {quiz.passingScorePercent}%
          </p>
        </div>
      </div>

      {quiz.negativeMarkingEnabled ? (
        <div className="mt-5 flex items-start gap-2 rounded-md border border-warning-500/30 bg-warning-50 px-3 py-2.5 text-sm text-warning-700">
          <AlertTriangle
            size={16}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            Negative marking is enabled — wrong answers deduct marks. Unanswered questions are never
            penalized.
          </span>
        </div>
      ) : null}
    </Card>
  );
}
