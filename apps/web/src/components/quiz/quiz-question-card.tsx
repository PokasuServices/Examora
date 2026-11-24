import { cn } from "@examora/ui";
import type { AttemptQuestion } from "@examora/types";
import { Card } from "@/components/ui/card";
import { StudyImage } from "@/components/student/study-image";
import { parseNumeric } from "./types";

const OPTION_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function hint(question: AttemptQuestion): string {
  if (question.type === "NUMERIC") return "Type your answer";
  return question.type === "MULTIPLE_CHOICE" ? "Select all that apply" : "Select one";
}

export function QuizQuestionCard({
  question,
  index,
  selectedOptionIds,
  numericValue = "",
  onToggle,
  onNumericChange,
}: {
  question: AttemptQuestion;
  index: number;
  selectedOptionIds: string[];
  /** NUMERIC only: the typed text. */
  numericValue?: string;
  onToggle: (optionId: string) => void;
  onNumericChange?: (raw: string) => void;
}) {
  const inputId = `numeric-${question.questionId}`;
  const invalid = numericValue.trim() !== "" && parseNumeric(numericValue) === null;

  return (
    <Card>
      <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
        Question {index + 1}
      </p>
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
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        {question.marks} {question.marks === 1 ? "mark" : "marks"} · {hint(question)}
      </p>

      {question.type === "NUMERIC" ? (
        <div className="mt-5 flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-sm text-neutral-700 dark:text-neutral-300">
            Your answer
          </label>
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={numericValue}
            onChange={(e) => onNumericChange?.(e.target.value)}
            placeholder="Enter a number"
            aria-invalid={invalid}
            aria-describedby={invalid ? `${inputId}-error` : undefined}
            className={cn(
              "h-11 w-full max-w-xs rounded-md border bg-white px-3 text-base text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:bg-neutral-900 dark:text-white",
              invalid ? "border-error-500" : "border-neutral-300 dark:border-neutral-700",
            )}
          />
          {invalid ? (
            <p id={`${inputId}-error`} className="text-xs text-error-600">
              Enter a number, e.g. 132.8
            </p>
          ) : null}
        </div>
      ) : (
        <fieldset className="mt-5 flex flex-col gap-2">
          <legend className="sr-only">Answer options for question {index + 1}</legend>
          {question.options.map((option, i) => {
            const selected = selectedOptionIds.includes(option.id);
            return (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-sm transition-colors",
                  selected
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-500/15"
                    : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-white/[0.03]",
                )}
              >
                <input
                  type={question.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                  name={question.questionId}
                  checked={selected}
                  onChange={() => onToggle(option.id)}
                  className="h-4 w-4 shrink-0 accent-primary-600"
                />
                {OPTION_KEYS[i] ? (
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-neutral-200 dark:border-neutral-800 text-[10px] font-medium text-neutral-400 dark:text-neutral-500"
                  >
                    {OPTION_KEYS[i]}
                  </span>
                ) : null}
                <span className="flex flex-col gap-2 text-neutral-800 dark:text-white/90">
                  {option.imageUrl ? (
                    <StudyImage
                      src={option.imageUrl}
                      alt={option.text || `Option ${i + 1}`}
                      className="max-h-40"
                    />
                  ) : null}
                  {option.text ? <span>{option.text}</span> : null}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
    </Card>
  );
}
