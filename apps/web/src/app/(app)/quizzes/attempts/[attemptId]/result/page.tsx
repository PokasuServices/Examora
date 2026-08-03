"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HelpCircle } from "lucide-react";
import type { AttemptResult } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState } from "@/components/ui/empty-state";
import { useQuizApi } from "@/lib/quiz-api";
import { QuizResultSummary } from "@/components/quiz/quiz-result-summary";
import { QuizResultStats } from "@/components/quiz/quiz-result-stats";
import { QuizResultSkeleton } from "@/components/quiz/skeletons";

type State = { status: "loading" | "error" | "ready"; result: AttemptResult | null };

function ResultContent() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const api = useQuizApi();
  const [state, setState] = React.useState<State>({ status: "loading", result: null });

  React.useEffect(() => {
    let cancelled = false;
    api
      .getResult(attemptId)
      .then((result) => !cancelled && setState({ status: "ready", result }))
      .catch(() => !cancelled && setState({ status: "error", result: null }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={HelpCircle}
          heading="Result not available"
          body="This attempt's result doesn't exist, or it hasn't been submitted yet."
          actionLabel="Back to quizzes"
          actionHref="/quizzes"
        />
      </main>
    );
  }

  if (state.status === "loading" || !state.result) {
    return <QuizResultSkeleton />;
  }

  const { result } = state;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
        <Link href="/quizzes" className="hover:underline">
          Quizzes
        </Link>{" "}
        <span aria-hidden="true">·</span>{" "}
        <span className="text-neutral-800">{result.quizTitle}</span>
      </nav>

      <QuizResultSummary result={result} />
      <QuizResultStats result={result} />

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/quizzes/attempts/${attemptId}/review`}
          className="flex h-11 items-center justify-center rounded-md bg-primary-600 px-6 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Review answers
        </Link>
        <Link
          href="/dashboard"
          className="flex h-11 items-center justify-center rounded-md border border-neutral-200 px-6 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Continue learning
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
