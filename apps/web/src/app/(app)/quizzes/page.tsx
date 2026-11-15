"use client";

import * as React from "react";
import Link from "next/link";
import type { QuizSummary } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { useQuizApi } from "@/lib/quiz-api";

function QuizCatalogContent() {
  const api = useQuizApi();
  const [quizzes, setQuizzes] = React.useState<QuizSummary[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api
      .listQuizzes()
      .then((res) => setQuizzes(res.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-800 dark:text-white/90">Quizzes</h1>
        <Link
          href="/dashboard"
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          My learning →
        </Link>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : null}
      {!loading && quizzes.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
          No published quizzes yet.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {quizzes.map((quiz) => (
          <Link
            key={quiz.id}
            href={`/quizzes/${quiz.id}`}
            className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 transition-colors hover:border-primary-400"
          >
            <h2 className="text-lg font-semibold">{quiz.title}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-600 dark:text-neutral-400">
              <span className="rounded-full bg-neutral-100 dark:bg-white/5 px-2 py-0.5">
                {quiz.totalQuestions} question{quiz.totalQuestions === 1 ? "" : "s"}
              </span>
              <span className="rounded-full bg-neutral-100 dark:bg-white/5 px-2 py-0.5">
                {quiz.totalMarks} marks
              </span>
              {quiz.timeLimitMinutes ? (
                <span className="rounded-full bg-neutral-100 dark:bg-white/5 px-2 py-0.5">
                  {quiz.timeLimitMinutes} min
                </span>
              ) : (
                <span className="rounded-full bg-neutral-100 dark:bg-white/5 px-2 py-0.5">
                  Untimed
                </span>
              )}
            </div>
            {quiz.description ? (
              <p className="mt-2 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                {quiz.description}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </main>
  );
}

export default function QuizCatalogPage() {
  return (
    <RequireAuth>
      <QuizCatalogContent />
    </RequireAuth>
  );
}
