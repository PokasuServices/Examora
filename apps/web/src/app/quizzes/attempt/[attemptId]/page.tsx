"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import type { AttemptQuestion, AttemptState } from "@examora/types";
import { Button } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { useQuizApi } from "@/lib/quiz-api";

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AttemptContent() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const router = useRouter();
  const api = useQuizApi();
  const [attempt, setAttempt] = React.useState<AttemptState | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, string[]>>({});
  const [remainingSeconds, setRemainingSeconds] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const submittingRef = React.useRef(false);

  const submit = React.useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await api.submitAttempt(attemptId);
    } finally {
      router.push(`/quizzes/attempts/${attemptId}/result`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  React.useEffect(() => {
    api
      .getAttempt(attemptId)
      .then((state) => {
        if (state.status !== "IN_PROGRESS") {
          router.replace(`/quizzes/attempts/${attemptId}/result`);
          return;
        }
        setAttempt(state);
        setRemainingSeconds(state.remainingSeconds);
        const initial: Record<string, string[]> = {};
        for (const q of state.questions) {
          initial[q.questionId] = q.selectedOptionIds;
        }
        setAnswers(initial);
      })
      .catch(() => router.replace("/quizzes"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  React.useEffect(() => {
    if (remainingSeconds === null) return;
    if (remainingSeconds <= 0) {
      void submit();
      return;
    }
    const timer = setTimeout(() => setRemainingSeconds((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remainingSeconds, submit]);

  function toggleOption(question: AttemptQuestion, optionId: string): void {
    setAnswers((prev) => {
      const current = prev[question.questionId] ?? [];
      const next =
        question.type === "MULTIPLE_CHOICE"
          ? current.includes(optionId)
            ? current.filter((id) => id !== optionId)
            : [...current, optionId]
          : [optionId];
      void api.autosaveAnswer(attemptId, question.questionId, next).catch(() => undefined);
      return { ...prev, [question.questionId]: next };
    });
  }

  if (!attempt) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  const question = attempt.questions[activeIndex]!;
  const answeredCount = Object.values(answers).filter((v) => v.length > 0).length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">{attempt.quizTitle}</h1>
        {remainingSeconds !== null ? (
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              remainingSeconds < 60 ? "bg-error-600 text-white" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {formatRemaining(remainingSeconds)}
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-sm text-neutral-500">
        {answeredCount} of {attempt.questions.length} answered
      </p>

      <nav className="mt-4 flex flex-wrap gap-2">
        {attempt.questions.map((q, i) => (
          <button
            key={q.questionId}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`h-8 w-8 rounded-md text-xs font-medium ${
              i === activeIndex
                ? "bg-primary-600 text-white"
                : (answers[q.questionId]?.length ?? 0) > 0
                  ? "bg-primary-100 text-primary-700"
                  : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <article className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <p className="text-body font-medium text-neutral-900">
          {activeIndex + 1}. {question.text}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {question.marks} mark{question.marks === 1 ? "" : "s"} ·{" "}
          {question.type === "MULTIPLE_CHOICE" ? "Select all that apply" : "Select one"}
        </p>

        <div className="mt-4 space-y-2">
          {question.options.map((option) => {
            const selected = (answers[question.questionId] ?? []).includes(option.id);
            return (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                  selected ? "border-primary-500 bg-primary-50" : "border-neutral-200"
                }`}
              >
                <input
                  type={question.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                  name={question.questionId}
                  checked={selected}
                  onChange={() => toggleOption(question, option.id)}
                />
                {option.text}
              </label>
            );
          })}
        </div>
      </article>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={activeIndex === 0}
            onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
          >
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={activeIndex === attempt.questions.length - 1}
            onClick={() => setActiveIndex((i) => Math.min(attempt.questions.length - 1, i + 1))}
          >
            Next
          </Button>
        </div>
        <Button disabled={submitting} onClick={() => void submit()}>
          {submitting ? "Submitting…" : "Submit quiz"}
        </Button>
      </div>
    </main>
  );
}

export default function AttemptPage() {
  return (
    <RequireAuth>
      <AttemptContent />
    </RequireAuth>
  );
}
