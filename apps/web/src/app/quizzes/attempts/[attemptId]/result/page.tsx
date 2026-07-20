"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { AttemptResult } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { useQuizApi } from "@/lib/quiz-api";

function ResultContent() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const api = useQuizApi();
  const [result, setResult] = React.useState<AttemptResult | null>(null);

  React.useEffect(() => {
    api
      .getResult(attemptId)
      .then(setResult)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  if (!result) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/quizzes" className="hover:underline">
          Quizzes
        </Link>{" "}
        · <span className="text-neutral-800">{result.quizTitle}</span>
      </nav>

      <div
        className={`rounded-lg border p-6 text-center ${
          result.passed
            ? "border-success-600 bg-success-500/10"
            : "border-error-600 bg-error-500/10"
        }`}
      >
        <p className="text-3xl font-bold">{result.percentage}%</p>
        <p className={`mt-1 font-medium ${result.passed ? "text-success-600" : "text-error-600"}`}>
          {result.passed ? "Passed" : "Not passed"}
        </p>
        {result.status === "AUTO_SUBMITTED" ? (
          <p className="mt-2 text-xs text-neutral-500">Auto-submitted when time ran out.</p>
        ) : null}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-neutral-500">Marks</dt>
          <dd className="font-medium">
            {result.obtainedMarks} / {result.totalMarks}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Correct</dt>
          <dd className="font-medium text-success-600">{result.correctCount}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Wrong</dt>
          <dd className="font-medium text-error-600">{result.wrongCount}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Unanswered</dt>
          <dd className="font-medium">{result.unansweredCount}</dd>
        </div>
      </dl>

      <div className="mt-8 flex gap-3">
        <Link
          href={`/quizzes/attempts/${attemptId}/review`}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Review answers
        </Link>
        <Link
          href="/quizzes"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Back to quizzes
        </Link>
      </div>
    </main>
  );
}

export default function ResultPage() {
  return (
    <RequireAuth>
      <ResultContent />
    </RequireAuth>
  );
}
