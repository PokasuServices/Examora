"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import type { AdminAttemptDetail, QuizAttemptStatus } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { useAssessmentApi } from "@/lib/assessment-api";

const STATUS_TONE: Record<QuizAttemptStatus, ChipTone> = {
  IN_PROGRESS: "primary",
  SUBMITTED: "success",
  AUTO_SUBMITTED: "warning",
};

function AttemptDetailContent() {
  const { id } = useParams<{ id: string }>();
  const api = useAssessmentApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = React.useState<AdminAttemptDetail | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .getAttempt(id)
      .then((a) => {
        setAttempt(a);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

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

  if (status === "error" || !attempt) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <RetryInline message="Couldn't load this attempt" onRetry={load} />
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/assessment/attempts"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Attempt monitoring
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-bold text-neutral-900">
          {attempt.quizTitle}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{attempt.userEmail}</p>
      </div>

      <Card>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-neutral-500">Status</dt>
            <dd className="mt-1">
              <Chip tone={STATUS_TONE[attempt.status]}>{statusLabel(attempt.status)}</Chip>
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Marks</dt>
            <dd className="mt-1 font-medium text-neutral-900">
              {attempt.obtainedMarks ?? "—"} / {attempt.totalMarks}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Percentage</dt>
            <dd className="mt-1 font-medium text-neutral-900">
              {attempt.percentage !== null ? `${attempt.percentage}%` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Passed</dt>
            <dd className="mt-1">
              {attempt.passed === null ? (
                <span className="font-medium text-neutral-900">—</span>
              ) : (
                <Chip tone={attempt.passed ? "success" : "danger"}>
                  {attempt.passed ? "Yes" : "No"}
                </Chip>
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <Card density="compact" className="min-w-0">
        <h2 className="px-2 pt-2 font-heading text-base font-semibold text-neutral-900">Answers</h2>
        {attempt.answers.length === 0 ? (
          <EmptyState icon={ClipboardCheck} heading="No answers recorded" />
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100">
            {attempt.answers.map((a) => (
              <li
                key={a.questionId}
                className="flex flex-wrap items-center justify-between gap-3 px-2 py-3"
              >
                <span className="min-w-0 max-w-md truncate text-sm text-neutral-800">
                  {a.questionText}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip
                    tone={
                      a.isCorrect === true
                        ? "success"
                        : a.isCorrect === false
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {a.isCorrect === true
                      ? "Correct"
                      : a.isCorrect === false
                        ? "Wrong"
                        : "Unanswered"}
                  </Chip>
                  {a.marksAwarded !== null ? (
                    <span className="text-xs text-neutral-500">{a.marksAwarded} marks</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}

export default function AttemptDetailPage() {
  return (
    <RequirePermission permission="quiz:attempts:read">
      <AttemptDetailContent />
    </RequirePermission>
  );
}
