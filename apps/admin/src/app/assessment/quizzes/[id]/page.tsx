"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { ContentStatus, Question, QuizDetail, QuizResultDashboard } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { StatusActions } from "@/components/status-actions";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { useAssessmentApi } from "@/lib/assessment-api";

const STATUS_TONE: Record<ContentStatus, ChipTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

type PendingAction =
  | { kind: "STATUS"; status: ContentStatus }
  | { kind: "REMOVE_SECTION"; id: string; title: string }
  | { kind: "UNASSIGN"; id: string; text: string }
  | null;

function QuizDetailContent() {
  const { id } = useParams<{ id: string }>();
  const api = useAssessmentApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [quiz, setQuiz] = React.useState<QuizDetail | null>(null);
  const [dashboard, setDashboard] = React.useState<QuizResultDashboard | null>(null);
  const [publishedQuestions, setPublishedQuestions] = React.useState<Question[]>([]);
  const [sectionTitle, setSectionTitle] = React.useState("");
  const [selectedQuestionId, setSelectedQuestionId] = React.useState("");
  const [selectedSectionId, setSelectedSectionId] = React.useState("");
  const [marks, setMarks] = React.useState("1");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<PendingAction>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .getQuiz(id)
      .then((q) => {
        setQuiz(q);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    api
      .getResultDashboard(id)
      .then(setDashboard)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    api
      .listQuestions({ status: "PUBLISHED" })
      .then((res) => setPublishedQuestions(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addSection(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await api.createSection(id, { title: sectionTitle });
      setSectionTitle("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add section");
    }
  }

  async function assignQuestion(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!selectedQuestionId) {
      setError("Choose a question to assign");
      return;
    }
    try {
      await api.assignQuestion(id, {
        questionId: selectedQuestionId,
        sectionId: selectedSectionId || undefined,
        marks: Number(marks),
      });
      setSelectedQuestionId("");
      setMarks("1");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign question");
    }
  }

  async function confirmPending(): Promise<void> {
    if (!pending) return;
    setError(null);
    setSubmitting(true);
    try {
      if (pending.kind === "STATUS") {
        await api.setQuizStatus(id, pending.status);
      } else if (pending.kind === "REMOVE_SECTION") {
        await api.deleteSection(id, pending.id);
      } else {
        await api.unassignQuestion(id, pending.id);
      }
      setPending(null);
      load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : pending.kind === "STATUS"
            ? "Status change failed"
            : pending.kind === "REMOVE_SECTION"
              ? "Could not remove section"
              : "Could not unassign question",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32" />
        <Card>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-4 h-24 w-full" />
        </Card>
      </main>
    );
  }

  if (status === "error" || !quiz) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <RetryInline message="Couldn't load this quiz" onRetry={load} />
        </Card>
      </main>
    );
  }

  const assignableQuestions = publishedQuestions.filter(
    (q) => !quiz.questions.some((assigned) => assigned.questionId === q.id),
  );

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/assessment/quizzes"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Quizzes
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold text-neutral-900">{quiz.title}</h1>
            <Chip tone={STATUS_TONE[quiz.status]}>{statusLabel(quiz.status)}</Chip>
          </div>
          <StatusActions
            status={quiz.status}
            onChange={(s) => setPending({ kind: "STATUS", status: s })}
          />
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          {quiz.totalQuestions} question{quiz.totalQuestions === 1 ? "" : "s"} · {quiz.totalMarks}{" "}
          marks · {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "Untimed"} · Pass at{" "}
          {quiz.passingScorePercent}%
        </p>
      </div>
      <FieldError>{error}</FieldError>

      {dashboard ? (
        <Card>
          <h2 className="font-heading text-base font-semibold text-neutral-900">Results</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-neutral-500">Total attempts</p>
              <p className="mt-1 text-lg font-semibold text-neutral-900">
                {dashboard.totalAttempts}
              </p>
            </div>
            <div>
              <p className="text-neutral-500">Completed</p>
              <p className="mt-1 text-lg font-semibold text-neutral-900">
                {dashboard.completedAttempts}
              </p>
            </div>
            <div>
              <p className="text-neutral-500">Pass rate</p>
              <p className="mt-1 text-lg font-semibold text-neutral-900">
                {dashboard.passRate !== null ? `${dashboard.passRate}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-neutral-500">Average score</p>
              <p className="mt-1 text-lg font-semibold text-neutral-900">
                {dashboard.averagePercentage !== null ? `${dashboard.averagePercentage}%` : "—"}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Sections</h2>
        <form onSubmit={addSection} className="mt-4 flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sectionTitle">New section title</Label>
            <Input
              id="sectionTitle"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!sectionTitle}>
            Add section
          </Button>
        </form>
        {quiz.sections.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-100">
            {quiz.sections.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-neutral-800">{s.title}</span>
                <Button
                  variant="ghost"
                  onClick={() => setPending({ kind: "REMOVE_SECTION", id: s.id, title: s.title })}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">
            No sections yet — questions can still be assigned unsectioned.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">
          Assigned questions
        </h2>
        <form onSubmit={assignQuestion} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-72">
            <SelectField
              id="question"
              label="Published question"
              value={selectedQuestionId}
              options={[
                { value: "", label: "— choose —" },
                ...assignableQuestions.map((q) => ({ value: q.id, label: q.text.slice(0, 60) })),
              ]}
              onChange={setSelectedQuestionId}
            />
          </div>
          {quiz.sections.length > 0 ? (
            <div className="w-full sm:w-48">
              <SelectField
                id="section"
                label="Section"
                value={selectedSectionId}
                options={[
                  { value: "", label: "— none —" },
                  ...quiz.sections.map((s) => ({ value: s.id, label: s.title })),
                ]}
                onChange={setSelectedSectionId}
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marks">Marks</Label>
            <Input
              id="marks"
              type="number"
              min={0.01}
              step={0.5}
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              className="w-24"
            />
          </div>
          <Button type="submit">Assign</Button>
        </form>

        {quiz.questions.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-100">
            {quiz.questions.map((assignment) => (
              <li
                key={assignment.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate text-neutral-800">
                  {assignment.question.text.slice(0, 80)}{" "}
                  <span className="text-neutral-400">({assignment.marks} marks)</span>
                </span>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setPending({
                      kind: "UNASSIGN",
                      id: assignment.id,
                      text: assignment.question.text.slice(0, 60),
                    })
                  }
                >
                  Unassign
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">
            No questions assigned yet — a quiz needs at least one PUBLISHED question assigned before
            it can be published.
          </p>
        )}
      </Card>

      <ConfirmDialog
        open={pending !== null}
        title={
          !pending
            ? ""
            : pending.kind === "STATUS"
              ? "Change quiz status?"
              : pending.kind === "REMOVE_SECTION"
                ? "Remove this section?"
                : "Unassign this question?"
        }
        message={
          !pending ? null : pending.kind === "STATUS" ? (
            <>
              Change status to{" "}
              <span className="font-medium text-neutral-800">{statusLabel(pending.status)}</span>?
            </>
          ) : pending.kind === "REMOVE_SECTION" ? (
            <>
              This removes <span className="font-medium text-neutral-800">{pending.title}</span>.
              Questions in it stay assigned to the quiz, unsectioned.
            </>
          ) : (
            <>
              Remove <span className="font-medium text-neutral-800">{pending.text}</span> from this
              quiz?
            </>
          )
        }
        confirmLabel={
          !pending
            ? "Confirm"
            : pending.kind === "STATUS"
              ? "Change status"
              : pending.kind === "REMOVE_SECTION"
                ? "Remove"
                : "Unassign"
        }
        tone={!pending ? "primary" : pending.kind === "STATUS" ? "primary" : "danger"}
        submitting={submitting}
        error={error}
        onConfirm={() => void confirmPending()}
        onCancel={() => setPending(null)}
      />
    </main>
  );
}

export default function QuizDetailPage() {
  return (
    <RequirePermission permission="quiz:manage">
      <QuizDetailContent />
    </RequirePermission>
  );
}
