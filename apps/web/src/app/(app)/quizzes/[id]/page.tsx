"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { AttemptHistoryItem, QuizStudentDetail } from "@examora/types";
import { Button } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { useQuizApi } from "@/lib/quiz-api";

function QuizDetailContent() {
  const { id: quizId } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useQuizApi();
  const [quiz, setQuiz] = React.useState<QuizStudentDetail | null>(null);
  const [history, setHistory] = React.useState<AttemptHistoryItem[]>([]);
  const [notFound, setNotFound] = React.useState(false);
  const [starting, setStarting] = React.useState(false);

  React.useEffect(() => {
    api
      .getQuiz(quizId)
      .then(setQuiz)
      .catch(() => setNotFound(true));
    api
      .listHistory(quizId)
      .then((res) => setHistory(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  async function handleStart(): Promise<void> {
    setStarting(true);
    try {
      const attempt = await api.startAttempt(quizId);
      router.push(`/quizzes/attempt/${attempt.id}`);
    } finally {
      setStarting(false);
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-heading">Quiz not available</h1>
        <Link
          href="/quizzes"
          className="mt-4 inline-block text-sm text-primary-600 hover:underline"
        >
          Back to quizzes
        </Link>
      </main>
    );
  }

  if (!quiz) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  const inProgress = history.find((h) => h.status === "IN_PROGRESS");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/quizzes" className="hover:underline">
          Quizzes
        </Link>{" "}
        · <span className="text-neutral-800">{quiz.title}</span>
      </nav>

      <h1 className="text-heading">{quiz.title}</h1>
      {quiz.description ? (
        <p className="mt-2 text-body text-neutral-600">{quiz.description}</p>
      ) : null}

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-neutral-500">Questions</dt>
          <dd className="font-medium">{quiz.totalQuestions}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Total marks</dt>
          <dd className="font-medium">{quiz.totalMarks}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Time limit</dt>
          <dd className="font-medium">
            {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "Untimed"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Passing score</dt>
          <dd className="font-medium">{quiz.passingScorePercent}%</dd>
        </div>
      </dl>

      {quiz.negativeMarkingEnabled ? (
        <p className="mt-4 rounded-md border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-sm text-warning-600">
          Negative marking is enabled for this quiz — wrong answers deduct marks. Unanswered
          questions are never penalized.
        </p>
      ) : null}

      {quiz.sections.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-neutral-700">Sections</h2>
          <ul className="mt-2 space-y-1 text-sm text-neutral-600">
            {quiz.sections.map((s) => (
              <li key={s.id}>
                {s.title} — {s.questionCount} question{s.questionCount === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8">
        <Button disabled={starting} onClick={() => void handleStart()}>
          {starting ? "Starting…" : inProgress ? "Resume attempt" : "Start attempt"}
        </Button>
      </div>

      {history.length > 0 ? (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-neutral-700">Your attempts</h2>
          <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {h.status === "IN_PROGRESS"
                    ? "In progress"
                    : `${h.percentage}% — ${h.passed ? "Passed" : "Not passed"}`}
                </span>
                {h.status !== "IN_PROGRESS" ? (
                  <Link
                    href={`/quizzes/attempts/${h.id}/result`}
                    className="text-primary-600 hover:underline"
                  >
                    View result →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </main>
  );
}

export default function QuizDetailPage() {
  return (
    <RequireAuth>
      <QuizDetailContent />
    </RequireAuth>
  );
}
