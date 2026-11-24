import Link from "next/link";
import { cn } from "@examora/ui";
import type { AnswerOutcome, AttemptReviewQuestion } from "@examora/types";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { QuestionExplanation } from "@/components/student/question-explanation";
import { StudyImage } from "@/components/student/study-image";

const OUTCOME: Record<
  AnswerOutcome,
  { label: string; tone: "success" | "warning" | "danger" | "neutral" }
> = {
  CORRECT: { label: "Correct", tone: "success" },
  PARTIAL: { label: "Partially correct", tone: "warning" },
  WRONG: { label: "Wrong", tone: "danger" },
  UNANSWERED: { label: "Unanswered", tone: "neutral" },
};

function formatMarks(marks: number | null): string {
  if (marks === null) return "";
  return ` (${marks >= 0 ? "+" : ""}${marks})`;
}

export function QuizReviewQuestionCard({
  question,
  index,
}: {
  question: AttemptReviewQuestion;
  index: number;
}) {
  const outcome = OUTCOME[question.outcome];
  const range = question.numericRange;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
          Question {index + 1}
        </p>
        <Chip tone={outcome.tone}>
          {outcome.label}
          {question.outcome === "UNANSWERED" ? "" : formatMarks(question.marksAwarded)}
        </Chip>
      </div>

      <p className="mt-1 whitespace-pre-line text-lg font-medium leading-relaxed text-neutral-900 dark:text-white/90">
        {question.text}
      </p>
      {question.imageUrl ? (
        <StudyImage
          src={question.imageUrl}
          alt={`Figure for question ${index + 1}`}
          className="mt-4"
        />
      ) : null}

      {question.type === "UPLOAD" ? (
        <div className="mt-5 flex flex-col gap-3 text-sm">
          {question.uploadRef ? (
            <StudyImage src={question.uploadRef} alt="Your sketch" className="max-h-80" />
          ) : (
            <p className="text-neutral-500">No sketch was uploaded.</p>
          )}
          {question.pendingReview ? (
            <p className="text-warning-700 dark:text-warning-300">
              Awaiting a reviewer&rsquo;s marks. Rate it yourself meanwhile on{" "}
              <Link href="/sketches" className="font-medium underline">
                My sketches
              </Link>
              .
            </p>
          ) : question.uploadRef ? (
            <p className="text-neutral-600 dark:text-neutral-400">
              Marked {question.marksAwarded ?? 0} / {question.marks}. See the feedback on{" "}
              <Link href="/sketches" className="font-medium text-primary-600 underline">
                My sketches
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : question.type === "NUMERIC" ? (
        <div className="mt-5 flex flex-wrap items-stretch gap-3 text-sm">
          <div
            className={cn(
              "rounded-md border px-4 py-3",
              question.outcome === "CORRECT"
                ? "border-success-500 bg-success-50 text-success-800 dark:bg-success-500/15 dark:text-success-300"
                : question.outcome === "WRONG"
                  ? "border-danger-500 bg-danger-50 text-danger-800 dark:bg-danger-500/15 dark:text-danger-300"
                  : "border-neutral-200 text-neutral-600 dark:border-neutral-800 dark:text-neutral-400",
            )}
          >
            Your answer: <strong>{question.numericAnswer ?? "—"}</strong>
          </div>
          {range ? (
            <div className="rounded-md border border-success-500 bg-success-50 px-4 py-3 text-success-800 dark:bg-success-500/15 dark:text-success-300">
              Accepted answer:{" "}
              <strong>{range.min === range.max ? range.min : `${range.min} – ${range.max}`}</strong>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-2">
          {question.options.map((option, i) => {
            const wasSelected = question.selectedOptionIds.includes(option.id);
            return (
              <div
                key={option.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm",
                  option.isCorrect
                    ? "border-success-500 bg-success-50 dark:bg-success-500/15 text-success-800 dark:text-success-300"
                    : wasSelected
                      ? "border-danger-500 bg-danger-50 dark:bg-danger-500/15 text-danger-800 dark:text-danger-300"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300",
                )}
              >
                <span className="flex flex-col gap-2">
                  {option.imageUrl ? (
                    <StudyImage
                      src={option.imageUrl}
                      alt={option.text || `Option ${i + 1}`}
                      className="max-h-40"
                    />
                  ) : null}
                  {option.text ? <span>{option.text}</span> : null}
                </span>
                <span className="shrink-0 text-xs font-medium">
                  {wasSelected ? "Your answer" : ""}
                  {wasSelected && option.isCorrect ? " · " : ""}
                  {option.isCorrect ? "Correct answer" : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <QuestionExplanation
        explanation={question.explanation}
        imageUrl={question.explanationImageUrl}
        steps={question.explanationSteps}
        videoUrl={question.explanationVideoUrl}
        resources={question.resources}
      />
    </Card>
  );
}
