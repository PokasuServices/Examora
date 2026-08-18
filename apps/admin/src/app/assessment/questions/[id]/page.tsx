"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { ContentStatus, Question } from "@examora/types";
import { Button, FieldError, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { StatusActions } from "@/components/status-actions";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { useAssessmentApi } from "@/lib/assessment-api";

const STATUS_TONE: Record<ContentStatus, ChipTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

type PendingAction = { kind: "STATUS"; status: ContentStatus } | { kind: "DELETE" } | null;

function QuestionDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useAssessmentApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [question, setQuestion] = React.useState<Question | null>(null);
  const [text, setText] = React.useState("");
  const [explanation, setExplanation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [pending, setPending] = React.useState<PendingAction>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .getQuestion(id)
      .then((q) => {
        setQuestion(q);
        setText(q.text);
        setExplanation(q.explanation ?? "");
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function saveDetails(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaved(false);
    try {
      const updated = await api.updateQuestion(id, { text, explanation: explanation || undefined });
      setQuestion(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    }
  }

  async function confirmPending(): Promise<void> {
    if (!pending) return;
    setError(null);
    setSubmitting(true);
    try {
      if (pending.kind === "STATUS") {
        setQuestion(await api.setQuestionStatus(id, pending.status));
        setPending(null);
      } else {
        await api.deleteQuestion(id);
        router.push("/assessment/questions");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : pending.kind === "STATUS"
            ? "Status change failed"
            : "Delete failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32" />
        <Card>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-4 h-24 w-full" />
        </Card>
      </main>
    );
  }

  if (status === "error" || !question) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <RetryInline message="Couldn't load this question" onRetry={load} />
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/assessment/questions"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Question bank
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold text-neutral-900">
              {statusLabel(question.type)}
            </h1>
            <Chip tone={STATUS_TONE[question.status]}>{statusLabel(question.status)}</Chip>
          </div>
          <StatusActions
            status={question.status}
            onChange={(s) => setPending({ kind: "STATUS", status: s })}
          />
        </div>
      </div>
      <FieldError>{error}</FieldError>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Details</h2>
        <form onSubmit={saveDetails} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="text">Question text</Label>
            <textarea
              id="text"
              className="min-h-16 rounded-md border border-neutral-300 bg-white p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="explanation">Explanation</Label>
            <textarea
              id="explanation"
              className="min-h-12 rounded-md border border-neutral-300 bg-white p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </div>
          {saved ? <p className="text-sm text-success-600">Saved.</p> : null}
          <div>
            <Button type="submit">Save details</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Options</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {question.options.map((o) => (
            <li
              key={o.id}
              className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
                o.isCorrect ? "border-success-500/30 bg-success-50" : "border-neutral-200"
              }`}
            >
              <span className="text-neutral-800">{o.text}</span>
              {o.isCorrect ? <Chip tone="success">Correct</Chip> : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-neutral-500">
          To change options, edit via the question bank list — options are not editable inline here
          this sprint.
        </p>
      </Card>

      <Card density="compact">
        <Button variant="ghost" onClick={() => setPending({ kind: "DELETE" })}>
          Delete question
        </Button>
      </Card>

      <ConfirmDialog
        open={pending !== null}
        title={
          !pending
            ? ""
            : pending.kind === "STATUS"
              ? "Change question status?"
              : "Delete this question?"
        }
        message={
          !pending ? null : pending.kind === "STATUS" ? (
            <>
              Change status to{" "}
              <span className="font-medium text-neutral-800">{statusLabel(pending.status)}</span>?
            </>
          ) : (
            "This permanently removes the question and its options. This can't be undone."
          )
        }
        confirmLabel={!pending ? "Confirm" : pending.kind === "STATUS" ? "Change status" : "Delete"}
        tone={!pending ? "primary" : pending.kind === "STATUS" ? "primary" : "danger"}
        submitting={submitting}
        error={error}
        onConfirm={() => void confirmPending()}
        onCancel={() => setPending(null)}
      />
    </main>
  );
}

export default function QuestionDetailPage() {
  return (
    <RequirePermission permission="question:manage">
      <QuestionDetailContent />
    </RequirePermission>
  );
}
