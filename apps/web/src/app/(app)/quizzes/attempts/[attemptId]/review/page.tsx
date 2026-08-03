"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { AttemptReview } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { useQuizApi } from "@/lib/quiz-api";

function ReviewContent() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const api = useQuizApi();
  const [review, setReview] = React.useState<AttemptReview | null>(null);

  React.useEffect(() => {
    api
      .getReview(attemptId)
      .then(setReview)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  if (!review) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href={`/quizzes/attempts/${attemptId}/result`} className="hover:underline">
          Result
        </Link>{" "}
        · <span className="text-neutral-800">Review — {review.quizTitle}</span>
      </nav>

      <h1 className="text-heading">Review your answers</h1>

      <div className="mt-6 space-y-4">
        {review.questions.map((q, i) => (
          <article key={q.questionId} className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-neutral-900">
                {i + 1}. {q.text}
              </p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  q.isCorrect === true
                    ? "bg-success-500/10 text-success-600"
                    : q.isCorrect === false
                      ? "bg-error-500/10 text-error-600"
                      : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {q.isCorrect === true ? "Correct" : q.isCorrect === false ? "Wrong" : "Unanswered"}
                {q.marksAwarded !== null
                  ? ` (${q.marksAwarded >= 0 ? "+" : ""}${q.marksAwarded})`
                  : ""}
              </span>
            </div>

            <div className="mt-3 space-y-1.5">
              {q.options.map((option) => {
                const wasSelected = q.selectedOptionIds.includes(option.id);
                return (
                  <div
                    key={option.id}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      option.isCorrect
                        ? "border-success-600 bg-success-500/10"
                        : wasSelected
                          ? "border-error-600 bg-error-500/10"
                          : "border-neutral-200"
                    }`}
                  >
                    {option.text}
                    {wasSelected ? " — your answer" : ""}
                    {option.isCorrect ? " — correct answer" : ""}
                  </div>
                );
              })}
            </div>

            {q.explanation ? (
              <p className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                {q.explanation}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </main>
  );
}

export default function ReviewPage() {
  return (
    <RequireAuth>
      <ReviewContent />
    </RequireAuth>
  );
}
