import { cn } from "@examora/ui";
import type { AttemptReviewQuestion } from "@examora/types";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";

export function QuizReviewQuestionCard({
  question,
  index,
}: {
  question: AttemptReviewQuestion;
  index: number;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-neutral-400">Question {index + 1}</p>
        <Chip
          tone={
            question.isCorrect === true
              ? "success"
              : question.isCorrect === false
                ? "danger"
                : "neutral"
          }
        >
          {question.isCorrect === true
            ? "Correct"
            : question.isCorrect === false
              ? "Wrong"
              : "Unanswered"}
          {question.marksAwarded !== null
            ? ` (${question.marksAwarded >= 0 ? "+" : ""}${question.marksAwarded})`
            : ""}
        </Chip>
      </div>

      <p className="mt-1 text-lg font-medium leading-relaxed text-neutral-900">{question.text}</p>

      <div className="mt-5 flex flex-col gap-2">
        {question.options.map((option) => {
          const wasSelected = question.selectedOptionIds.includes(option.id);
          return (
            <div
              key={option.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm",
                option.isCorrect
                  ? "border-success-500 bg-success-50 text-success-800"
                  : wasSelected
                    ? "border-danger-500 bg-danger-50 text-danger-800"
                    : "border-neutral-200 text-neutral-700",
              )}
            >
              <span>{option.text}</span>
              <span className="shrink-0 text-xs font-medium">
                {wasSelected ? "Your answer" : ""}
                {wasSelected && option.isCorrect ? " · " : ""}
                {option.isCorrect ? "Correct answer" : ""}
              </span>
            </div>
          );
        })}
      </div>

      {question.explanation ? (
        <p className="mt-4 rounded-md bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          {question.explanation}
        </p>
      ) : null}
    </Card>
  );
}
