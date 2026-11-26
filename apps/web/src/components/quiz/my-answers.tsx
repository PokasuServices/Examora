"use client";

import * as React from "react";
import { MessageSquareWarning } from "lucide-react";
import type { AttemptAnalysis, AttemptReview } from "@examora/types";
import { Button, cn } from "@examora/ui";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { SelectField } from "@/components/ui/select-field";
import { ToneCard, toneClasses, type Tone } from "@/components/ui/tone-card";
import { QuestionPalette } from "@/components/quiz/question-palette";
import { QuizReviewQuestionCard } from "@/components/quiz/quiz-review-question";
import type { PaletteTone } from "@/components/quiz/types";
import { DoubtsThread } from "@/components/student/doubts-thread";
import { formatDuration, METHOD_LABEL, useStudentApi } from "@/lib/student-api";

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Attempt number, finish time, how it ended, and XP earned. */
function AttemptDetails({ a }: { a: AttemptAnalysis }) {
  const items: [string, React.ReactNode, Tone][] = [
    ["Attempt", `No. ${a.attemptNumber}`, "indigo"],
    ["Completed on", a.submittedAt ? DATE_FORMAT.format(new Date(a.submittedAt)) : "—", "cyan"],
    [
      "State",
      a.status === "AUTO_SUBMITTED" ? (
        <Chip tone="warning">Submitted when time ran out</Chip>
      ) : (
        <Chip tone="success">Completed</Chip>
      ),
      a.status === "AUTO_SUBMITTED" ? "amber" : "emerald",
    ],
    ["XP earned", a.xpEarned > 0 ? `+${a.xpEarned} XP` : "None this attempt", "violet"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
      {items.map(([label, value, tone], i) => (
        <ToneCard key={label} tone={tone} index={i} className="px-4 py-3">
          <dt className={cn("text-xs font-medium uppercase tracking-wide", toneClasses(tone).text)}>
            {label}
          </dt>
          <dd className="mt-1 font-semibold text-neutral-800 dark:text-white/90">{value}</dd>
        </ToneCard>
      ))}
    </dl>
  );
}

/**
 * "My answers" tab of a quiz report: every question with the student's answer,
 * the explanation, a report button and the discussion. `index` is the question's
 * position in the attempt (0-based) and is controlled by the report page, so
 * other parts of the report can jump to a question.
 */
export function MyAnswers({
  attemptId,
  analysis,
  review,
  index,
  onIndexChange,
}: {
  attemptId: string;
  analysis: AttemptAnalysis;
  review: AttemptReview;
  index: number;
  onIndexChange: (index: number) => void;
}) {
  const studentApi = useStudentApi();
  const [subject, setSubject] = React.useState("ALL");
  const [reported, setReported] = React.useState<Set<string>>(new Set());
  const [reportFor, setReportFor] = React.useState<string | null>(null);
  const [reportText, setReportText] = React.useState("");

  const subjects = [...new Set(review.questions.map((q) => q.subjectTitle ?? "General"))];
  const indexes = review.questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => subject === "ALL" || (q.subjectTitle ?? "General") === subject)
    .map(({ i }) => i);

  // A jump from elsewhere in the report to a question outside the filter clears the filter.
  React.useEffect(() => {
    if (subject !== "ALL" && !indexes.includes(index)) setSubject("ALL");
  }, [index, subject, indexes]);

  const safeIndex = Math.min(Math.max(index, 0), review.questions.length - 1);
  const current = Math.max(indexes.indexOf(safeIndex), 0);
  const questionIndex = indexes[current] ?? safeIndex;
  const question = review.questions[questionIndex];
  if (!question) return null;

  function getTone(i: number): PaletteTone {
    const q = review.questions[indexes[i] ?? 0];
    if (q?.outcome === "CORRECT") return "correct";
    if (q?.outcome === "PARTIAL") return "partial";
    return q?.outcome === "WRONG" ? "wrong" : "unanswered";
  }

  return (
    <div className="flex flex-col gap-6">
      <AttemptDetails a={analysis} />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">
              Your score: {analysis.obtainedMarks} / {analysis.totalMarks}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Pick a question. Green is correct, red is wrong, amber is part marks, grey is skipped.
            </p>
          </div>
          {subjects.length > 1 ? (
            <div className="w-full sm:w-56">
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
                  const first = review.questions.findIndex(
                    (q) => v === "ALL" || (q.subjectTitle ?? "General") === v,
                  );
                  if (first >= 0) onIndexChange(first);
                }}
              />
            </div>
          ) : null}
        </div>
        <QuestionPalette
          count={indexes.length}
          activeIndex={current}
          onSelect={(i) => onIndexChange(indexes[i] ?? 0)}
          getTone={getTone}
        />
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {question.topicTitle ? <Chip tone="neutral">{question.topicTitle}</Chip> : null}
        {question.method ? (
          <Chip tone="primary">You said: {METHOD_LABEL[question.method]}</Chip>
        ) : null}
        {question.timeSpentSeconds ? (
          <Chip tone="neutral">{formatDuration(question.timeSpentSeconds)} spent</Chip>
        ) : null}
        <Chip tone="neutral">
          Marks gained: {question.marksAwarded ?? 0} of {question.marks}
        </Chip>
      </div>

      <div>
        <QuizReviewQuestionCard question={question} index={questionIndex} />
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
        <DoubtsThread
          questionId={question.questionId}
          question={question}
          questionIndex={questionIndex}
        />
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          disabled={current === 0}
          onClick={() => onIndexChange(indexes[current - 1] ?? questionIndex)}
        >
          Previous
        </Button>
        <Button
          variant="ghost"
          disabled={current >= indexes.length - 1}
          onClick={() => onIndexChange(indexes[current + 1] ?? questionIndex)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
