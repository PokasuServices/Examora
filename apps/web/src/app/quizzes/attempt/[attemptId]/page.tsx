"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState } from "@/components/ui/empty-state";
import { useQuizAttempt } from "@/components/quiz/use-quiz-attempt";
import { useAttemptKeyboardShortcuts } from "@/components/quiz/use-attempt-keyboard-shortcuts";
import { AttemptHeader } from "@/components/quiz/attempt-header";
import { QuestionPalette } from "@/components/quiz/question-palette";
import { QuizQuestionCard } from "@/components/quiz/quiz-question-card";
import { SubmitConfirmDialog } from "@/components/quiz/submit-confirm-dialog";
import type { PaletteTone } from "@/components/quiz/types";

function AttemptContent() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const {
    loadState,
    attempt,
    questions,
    answers,
    answeredCount,
    remainingSeconds,
    activeIndex,
    setActiveIndex,
    autosaveStatus,
    submitting,
    toggleOption,
    submit,
  } = useQuizAttempt(attemptId);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const question = questions[activeIndex];

  const navigate = React.useCallback(
    (direction: -1 | 1) => {
      setActiveIndex((i) => Math.min(questions.length - 1, Math.max(0, i + direction)));
    },
    [questions.length, setActiveIndex],
  );
  const handleToggle = React.useCallback(
    (optionId: string) => {
      if (question) toggleOption(question, optionId);
    },
    [question, toggleOption],
  );
  useAttemptKeyboardShortcuts(question, navigate, handleToggle);

  if (loadState === "not-found") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={HelpCircle}
          heading="Attempt not available"
          body="This attempt doesn't exist or doesn't belong to you."
          actionLabel="Back to quizzes"
          actionHref="/quizzes"
        />
      </main>
    );
  }

  if (loadState === "loading" || !attempt || !question) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  function getTone(i: number): PaletteTone {
    const q = questions[i];
    return q && (answers[q.questionId]?.length ?? 0) > 0 ? "answered" : "unanswered";
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <AttemptHeader
        quizId={attempt.quizId}
        quizTitle={attempt.quizTitle}
        remainingSeconds={remainingSeconds}
        answeredCount={answeredCount}
        totalCount={questions.length}
        autosaveStatus={autosaveStatus}
      />

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <QuestionPalette
          count={questions.length}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          getTone={getTone}
        />

        <QuizQuestionCard
          question={question}
          index={activeIndex}
          selectedOptionIds={answers[question.questionId] ?? []}
          onToggle={handleToggle}
        />

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={activeIndex === 0}
              onClick={() => navigate(-1)}
              className="flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={activeIndex === questions.length - 1}
              onClick={() => navigate(1)}
              className="flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-40"
            >
              Next
            </button>
          </div>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="flex h-10 items-center justify-center rounded-md bg-primary-600 px-5 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Submit quiz
          </button>
        </div>

        <p className="text-center text-xs text-neutral-400">
          Use <kbd className="rounded border border-neutral-200 px-1 py-0.5">←</kbd>{" "}
          <kbd className="rounded border border-neutral-200 px-1 py-0.5">→</kbd> to move between
          questions, <kbd className="rounded border border-neutral-200 px-1 py-0.5">1</kbd>–
          <kbd className="rounded border border-neutral-200 px-1 py-0.5">9</kbd> to select an option
        </p>
      </main>

      <SubmitConfirmDialog
        open={confirmOpen}
        answeredCount={answeredCount}
        totalCount={questions.length}
        submitting={submitting}
        onConfirm={() => void submit()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export default function AttemptPage() {
  return (
    <RequireAuth>
      <AttemptContent />
    </RequireAuth>
  );
}
