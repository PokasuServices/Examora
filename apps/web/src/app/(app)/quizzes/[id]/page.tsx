"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState } from "@/components/ui/empty-state";
import { useQuizLanding } from "@/components/quiz/use-quiz-landing";
import { QuizMetaGrid } from "@/components/quiz/quiz-meta-grid";
import { AttemptHistoryList } from "@/components/quiz/attempt-history-list";
import { QuizLandingSkeleton } from "@/components/quiz/skeletons";

function QuizLandingContent() {
  const { id: quizId } = useParams<{ id: string }>();
  const router = useRouter();
  const landing = useQuizLanding(quizId);
  const { starting, startOrResume } = landing;
  const [startError, setStartError] = React.useState<string | null>(null);

  if (landing.status === "not-found") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={HelpCircle}
          heading="Quiz not available"
          body="This quiz doesn't exist, isn't published, or has been removed."
          actionLabel="Back to quizzes"
          actionHref="/quizzes"
        />
      </main>
    );
  }

  if (landing.status === "loading") {
    return <QuizLandingSkeleton />;
  }

  const { quiz, history } = landing;
  const inProgress = history.find((h) => h.status === "IN_PROGRESS");

  async function handleStart(): Promise<void> {
    setStartError(null);
    try {
      const attemptId = await startOrResume();
      router.push(`/quizzes/attempt/${attemptId}`);
    } catch {
      setStartError("Couldn't start the quiz. Please try again.");
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
        <Link href="/quizzes" className="hover:underline">
          Quizzes
        </Link>{" "}
        <span aria-hidden="true">·</span> <span className="text-neutral-800">{quiz.title}</span>
      </nav>

      <div>
        <h1 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
          {quiz.title}
        </h1>
        {quiz.description ? <p className="mt-2 text-neutral-600">{quiz.description}</p> : null}
      </div>

      <QuizMetaGrid quiz={quiz} />

      {quiz.sections.length > 0 ? (
        <div>
          <h2 className="font-heading text-lg font-semibold text-neutral-900">Sections</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-600">
            {quiz.sections.map((s) => (
              <li key={s.id} className="flex items-center justify-between">
                <span>{s.title}</span>
                <span className="tabular-nums text-neutral-400">
                  {s.questionCount} {s.questionCount === 1 ? "question" : "questions"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <button
          type="button"
          disabled={starting}
          onClick={() => void handleStart()}
          className="flex h-11 items-center justify-center rounded-md bg-primary-600 px-6 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
        >
          {starting ? "Starting…" : inProgress ? "Resume attempt" : "Start quiz"}
        </button>
        {startError ? <p className="mt-2 text-sm text-error-600">{startError}</p> : null}
      </div>

      <AttemptHistoryList history={history} />
    </main>
  );
}

export default function QuizLandingPage() {
  return (
    <RequireAuth>
      <QuizLandingContent />
    </RequireAuth>
  );
}
