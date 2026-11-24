"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import { ANSWER_METHODS, type AnswerMethod, type LessonPracticeQuestion } from "@examora/types";
import { Button, FieldError, Input, cn } from "@examora/ui";
import { Check, X } from "lucide-react";
import { QuestionExplanation } from "@/components/student/question-explanation";
import { StudyImage } from "@/components/student/study-image";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { useLearnApi } from "@/lib/learn-api";
import { METHOD_LABEL } from "@/lib/student-api";

function PracticeQuestion({
  lessonId,
  index,
  question,
  onAnswered,
}: {
  lessonId: string;
  index: number;
  question: LessonPracticeQuestion;
  onAnswered: (q: LessonPracticeQuestion) => void;
}) {
  const api = useLearnApi();
  const multi = question.type === "MULTIPLE_CHOICE";
  const numeric = question.type === "NUMERIC";
  const answer = question.answer;
  const [picked, setPicked] = React.useState<string[]>([]);
  const [value, setValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const ready = numeric ? value.trim() !== "" && !Number.isNaN(Number(value)) : picked.length > 0;

  function toggle(id: string) {
    if (answer) return;
    setPicked((p) => (multi ? (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]) : [id]));
  }

  async function submit(method: AnswerMethod) {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.answerLessonQuestion(lessonId, question.id, {
        ...(numeric ? { numericValue: Number(value) } : { optionIds: picked }),
        method,
      });
      onAnswered(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your answer. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const chosen = new Set(answer ? answer.selectedOptionIds : picked);
  const correct = new Set(answer?.correctOptionIds ?? []);

  return (
    <li className="flex flex-col gap-4 border-t border-neutral-200 pt-6 first:border-t-0 first:pt-0 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-neutral-800 dark:text-white/90">
          <span className="mr-1.5 text-neutral-500">Q{index + 1}.</span>
          {question.text}
        </p>
        {answer ? (
          <Chip tone={answer.correct ? "success" : "danger"}>
            {answer.correct ? "Correct" : "Not quite"}
          </Chip>
        ) : multi ? (
          <Chip tone="neutral">Pick all that apply</Chip>
        ) : null}
      </div>
      {question.imageUrl ? (
        <StudyImage src={question.imageUrl} alt="" className="max-h-80 w-auto self-start" />
      ) : null}

      {numeric ? (
        <div className="flex flex-col gap-1.5 sm:max-w-xs">
          <Input
            type="number"
            inputMode="decimal"
            aria-label={`Answer to question ${index + 1}`}
            value={answer ? String(answer.numericValue ?? "") : value}
            disabled={Boolean(answer)}
            onChange={(e) => setValue(e.target.value)}
          />
          {answer?.numericRange ? (
            <p className="text-xs text-neutral-500">
              Accepted answer: {answer.numericRange.min} to {answer.numericRange.max}
            </p>
          ) : null}
        </div>
      ) : (
        <ul
          role={multi ? "group" : "radiogroup"}
          aria-label={`Options for question ${index + 1}`}
          className="flex flex-col gap-2"
        >
          {question.options.map((o, i) => {
            const isChosen = chosen.has(o.id);
            const isRight = answer ? correct.has(o.id) : false;
            const isWrongPick = answer ? isChosen && !isRight : false;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  role={multi ? "checkbox" : "radio"}
                  aria-checked={isChosen}
                  disabled={Boolean(answer)}
                  onClick={() => toggle(o.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                    isRight
                      ? "border-success-300 bg-success-50 dark:border-success-500/40 dark:bg-success-500/10"
                      : isWrongPick
                        ? "border-danger-300 bg-danger-50 dark:border-danger-500/40 dark:bg-danger-500/10"
                        : isChosen
                          ? "border-primary-400 bg-primary-50 dark:border-primary-500/50 dark:bg-primary-500/10"
                          : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-white/[0.03]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
                  >
                    {isRight ? (
                      <Check size={14} className="text-success-600" />
                    ) : isWrongPick ? (
                      <X size={14} className="text-danger-600" />
                    ) : (
                      String.fromCharCode(65 + i)
                    )}
                  </span>
                  <span className="flex-1 text-neutral-700 dark:text-neutral-300">
                    {o.imageUrl ? (
                      <StudyImage
                        src={o.imageUrl}
                        alt={o.text || `Option ${i + 1}`}
                        className="max-h-32"
                      />
                    ) : null}
                    {o.text}
                  </span>
                  {answer && isChosen ? (
                    <span className="text-xs text-neutral-500">Your answer</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {answer ? (
        <>
          {answer.method ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              How you got it: <strong>{METHOD_LABEL[answer.method]}</strong>
            </p>
          ) : null}
          <QuestionExplanation
            explanation={answer.explanation}
            imageUrl={answer.explanationImageUrl}
            videoUrl={answer.explanationVideoUrl}
            resources={answer.resources}
          />
        </>
      ) : (
        <div
          role="group"
          aria-labelledby={`lq-method-${question.id}`}
          className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3 dark:bg-white/[0.03]"
        >
          <p
            id={`lq-method-${question.id}`}
            className="text-xs text-neutral-600 dark:text-neutral-400"
          >
            {ready
              ? "Submit by telling us how you got it:"
              : "Choose an answer, then submit by telling us how you got it."}
          </p>
          <div className="flex flex-wrap gap-2">
            {ANSWER_METHODS.map((m) => (
              <Button
                key={m}
                size="sm"
                variant="outline"
                disabled={!ready || saving}
                onClick={() => void submit(m)}
              >
                {METHOD_LABEL[m]}
              </Button>
            ))}
          </div>
          {error ? <FieldError>{error}</FieldError> : null}
        </div>
      )}
    </li>
  );
}

/** Past-paper style questions inside a lesson: one try each, explanation right after. */
export function LessonPractice({
  lessonId,
  questions: initial,
}: {
  lessonId: string;
  questions: LessonPracticeQuestion[];
}) {
  const [questions, setQuestions] = React.useState(initial);
  React.useEffect(() => setQuestions(initial), [initial]);
  if (questions.length === 0) return null;
  const answered = questions.filter((q) => q.answer).length;
  const right = questions.filter((q) => q.answer?.correct).length;

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium text-neutral-800 dark:text-white/90">Try these</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">
          {answered === 0
            ? `${questions.length} questions · one try each`
            : `${right} of ${answered} right · ${questions.length - answered} left`}
        </p>
      </div>
      <ol className="mt-5 flex flex-col gap-6">
        {questions.map((q, i) => (
          <PracticeQuestion
            key={q.id}
            lessonId={lessonId}
            index={i}
            question={q}
            onAnswered={(updated) =>
              setQuestions((list) => list.map((x) => (x.id === updated.id ? updated : x)))
            }
          />
        ))}
      </ol>
    </Card>
  );
}
