"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { ContentStatus, Question } from "@examora/types";
import { Button, FieldError } from "@examora/ui";
import { QuestionEditor } from "@/components/question-editor";
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
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<PendingAction>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .getQuestion(id)
      .then((q) => {
        setQuestion(q);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

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
      <main className="flex flex-col gap-6">
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
      <main>
        <Card>
          <RetryInline message="Couldn't load this question" onRetry={load} />
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <div>
        <Link
          href="/assessment/questions"
          className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Question bank
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-neutral-800 dark:text-white/90">
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
        <QuestionEditor key={question.updatedAt} initial={question} onSaved={setQuestion} />
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
              <span className="font-medium text-neutral-800 dark:text-white/90">
                {statusLabel(pending.status)}
              </span>
              ?
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
