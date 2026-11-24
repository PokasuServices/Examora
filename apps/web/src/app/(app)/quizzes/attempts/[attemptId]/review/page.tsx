"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HelpCircle, MessageSquareWarning } from "lucide-react";
import type { AttemptReview } from "@examora/types";
import { Button } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState } from "@/components/ui/empty-state";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { useQuizApi } from "@/lib/quiz-api";
import { QuestionPalette } from "@/components/quiz/question-palette";
import { QuizReviewQuestionCard } from "@/components/quiz/quiz-review-question";
import { QuizReviewSkeleton } from "@/components/quiz/skeletons";
import type { PaletteTone } from "@/components/quiz/types";
import { DoubtsThread } from "@/components/student/doubts-thread";
import { formatDuration, METHOD_LABEL, useStudentApi } from "@/lib/student-api";

type State = { status: "loading" | "error" | "ready"; review: AttemptReview | null };

function ReviewContent() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const api = useQuizApi();
  const studentApi = useStudentApi();
  const [state, setState] = React.useState<State>({ status: "loading", review: null });
  const [subject, setSubject] = React.useState("ALL");
  const [position, setPosition] = React.useState(0);
  const [reported, setReported] = React.useState<Set<string>>(new Set());
  const [reportFor, setReportFor] = React.useState<string | null>(null);
  const [reportText, setReportText] = React.useState("");

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
      <main className="mx-auto max-w-2xl">
        <EmptyState
          icon={HelpCircle}
          heading="Review not available"
          body="This attempt hasn't been submitted yet, or doesn't exist."
          actionLabel="Back to practice"
          actionHref="/practice"
        />
      </main>
    );
  }
  if (state.status === "loading" || !state.review) return <QuizReviewSkeleton />;

  const { review } = state;
  const subjects = [...new Set(review.questions.map((q) => q.subjectTitle ?? "General"))];
  const indexes = review.questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => subject === "ALL" || (q.subjectTitle ?? "General") === subject)
    .map(({ i }) => i);
  const current = Math.min(position, Math.max(indexes.length - 1, 0));
  const index = indexes[current] ?? 0;
  const question = review.questions[index];
  if (!question) return null;

  function getTone(i: number): PaletteTone {
    const q = review.questions[indexes[i] ?? 0];
    if (q?.outcome === "CORRECT") return "correct";
    if (q?.outcome === "PARTIAL") return "partial";
    return q?.outcome === "WRONG" ? "wrong" : "unanswered";
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title={`Answers: ${review.quizTitle}`}
        trail={[{ label: "Report", href: `/quizzes/attempts/${attemptId}/result` }]}
        actions={
          <Link
            href={`/quizzes/attempts/${attemptId}/result`}
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            Back to report
          </Link>
        }
      />

      {subjects.length > 1 ? (
        <div className="w-full sm:w-64">
          <SelectField
            id="review-subject"
            label="Subject"
            value={subject}
            options={[
              { value: "ALL", label: "All subjects" },
              ...subjects.map((s) => ({ value: s, label: s })),
            ]}
            onChange={(v) => {
              setSubject(v);
              setPosition(0);
            }}
          />
        </div>
      ) : null}

      <QuestionPalette
        count={indexes.length}
        activeIndex={current}
        onSelect={setPosition}
        getTone={getTone}
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {question.topicTitle ? <Chip tone="neutral">{question.topicTitle}</Chip> : null}
        {question.method ? (
          <Chip tone="primary">You said: {METHOD_LABEL[question.method]}</Chip>
        ) : null}
        {question.timeSpentSeconds ? (
          <Chip tone="neutral">{formatDuration(question.timeSpentSeconds)} spent</Chip>
        ) : null}
      </div>

      <div>
        <QuizReviewQuestionCard question={question} index={index} />
        <div className="mt-3 flex justify-end">
          {reported.has(question.questionId) ? (
            <span className="text-xs text-success-600">Reported. Thanks!</span>
          ) : reportFor === question.questionId ? (
            <div className="flex w-full flex-col gap-2">
              <textarea
                aria-label="What's wrong with this question?"
                placeholder="What's wrong with this question?"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                className="min-h-16 w-full rounded-md border border-neutral-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setReportFor(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={reportText.trim().length < 3}
                  onClick={async () => {
                    await studentApi
                      .reportQuestion(question.questionId, reportText.trim(), attemptId)
                      .catch(() => undefined);
                    setReported((prev) => new Set(prev).add(question.questionId));
                    setReportFor(null);
                    setReportText("");
                  }}
                >
                  Send report
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setReportFor(question.questionId)}>
              <MessageSquareWarning size={16} aria-hidden="true" /> Report question
            </Button>
          )}
        </div>
        <DoubtsThread questionId={question.questionId} />
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          disabled={current === 0}
          onClick={() => setPosition((p) => Math.max(0, p - 1))}
        >
          Previous
        </Button>
        <Button
          variant="ghost"
          disabled={current >= indexes.length - 1}
          onClick={() => setPosition((p) => Math.min(indexes.length - 1, p + 1))}
        >
          Next
        </Button>
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
