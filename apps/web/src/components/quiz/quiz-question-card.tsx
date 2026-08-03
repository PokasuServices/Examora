import { cn } from "@examora/ui";
import type { AttemptQuestion } from "@examora/types";
import { Card } from "@/components/ui/card";

const OPTION_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function QuizQuestionCard({
  question,
  index,
  selectedOptionIds,
  onToggle,
}: {
  question: AttemptQuestion;
  index: number;
  selectedOptionIds: string[];
  onToggle: (optionId: string) => void;
}) {
  return (
    <Card>
      <p className="text-xs font-medium text-neutral-400">Question {index + 1}</p>
      <p className="mt-1 text-lg font-medium leading-relaxed text-neutral-900">{question.text}</p>
      <p className="mt-2 text-xs text-neutral-500">
        {question.marks} {question.marks === 1 ? "mark" : "marks"} ·{" "}
        {question.type === "MULTIPLE_CHOICE" ? "Select all that apply" : "Select one"}
      </p>

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
                  ? "border-primary-500 bg-primary-50"
                  : "border-neutral-200 hover:bg-neutral-50",
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
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-neutral-200 text-[10px] font-medium text-neutral-400"
                >
                  {OPTION_KEYS[i]}
                </span>
              ) : null}
              <span className="text-neutral-800">{option.text}</span>
            </label>
          );
        })}
      </fieldset>
    </Card>
  );
}
