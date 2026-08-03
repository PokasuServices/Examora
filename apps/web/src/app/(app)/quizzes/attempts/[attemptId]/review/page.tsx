"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HelpCircle } from "lucide-react";
import type { AttemptReview } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState } from "@/components/ui/empty-state";
import { useQuizApi } from "@/lib/quiz-api";
import { QuestionPalette } from "@/components/quiz/question-palette";
import { QuizReviewQuestionCard } from "@/components/quiz/quiz-review-question";
import { QuizReviewSkeleton } from "@/components/quiz/skeletons";
import type { PaletteTone } from "@/components/quiz/types";

type State = { status: "loading" | "error" | "ready"; review: AttemptReview | null };

function ReviewContent() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const api = useQuizApi();
  const [state, setState] = React.useState<State>({ status: "loading", review: null });
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    api
      .getReview(attemptId)
      .then((review) => !cancelled && setState({ status: "ready", review }))
      .catch(() => !cancelled && setState({ status: "error", review: null }));
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
          heading="Review not available"
          body="This attempt hasn't been submitted yet, or doesn't exist."
          actionLabel="Back to quizzes"
          actionHref="/quizzes"
        />
      </main>
    );
  }

  if (state.status === "loading" || !state.review) {
    return <QuizReviewSkeleton />;
  }

  const { review } = state;
  const question = review.questions[activeIndex];
  if (!question) return null;

  function getTone(i: number): PaletteTone {
    const q = review.questions[i];
    return q?.isCorrect === true ? "correct" : q?.isCorrect === false ? "wrong" : "unanswered";
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
        <Link href={`/quizzes/attempts/${attemptId}/result`} className="hover:underline">
          Result
        </Link>{" "}
        <span aria-hidden="true">·</span> <span className="text-neutral-800">Review</span>
      </nav>

      <h1 className="font-heading text-2xl font-bold text-neutral-900">
        Review — {review.quizTitle}
      </h1>

      <QuestionPalette
        count={review.questions.length}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        getTone={getTone}
      />

      <QuizReviewQuestionCard question={question} index={activeIndex} />

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={activeIndex === 0}
          onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
          className="flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={activeIndex === review.questions.length - 1}
          onClick={() => setActiveIndex((i) => Math.min(review.questions.length - 1, i + 1))}
          className="flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-40"
        >
          Next
        </button>
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
