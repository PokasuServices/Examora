"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import type { AdminAttemptSummary, QuizAttemptStatus } from "@examora/types";
import { QUIZ_ATTEMPT_STATUSES } from "@examora/types";
import { Button } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { useAssessmentApi } from "@/lib/assessment-api";

const STATUS_FILTERS: (QuizAttemptStatus | "ALL")[] = ["ALL", ...QUIZ_ATTEMPT_STATUSES];

const STATUS_TONE: Record<QuizAttemptStatus, ChipTone> = {
  IN_PROGRESS: "primary",
  SUBMITTED: "success",
  AUTO_SUBMITTED: "warning",
};

function AttemptsContent() {
  const api = useAssessmentApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [attempts, setAttempts] = React.useState<AdminAttemptSummary[]>([]);
  const [filter, setFilter] = React.useState<QuizAttemptStatus | "ALL">("ALL");

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listAttempts(filter === "ALL" ? undefined : { status: filter })
      .then((res) => {
        setAttempts(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Attempt monitoring"
        subtitle="Track in-progress and completed quiz attempts across the platform."
        actions={
          <Link href="/assessment/quizzes">
            <Button variant="secondary">Quizzes</Button>
          </Link>
        }
      />

      <Card density="compact">
        <div className="max-w-xs">
          <SelectField
            id="attempt-status-filter"
            label="Status"
            value={filter}
            options={STATUS_FILTERS.map((s) => ({
              value: s,
              label: s === "ALL" ? "All statuses" : statusLabel(s),
            }))}
            onChange={(v) => setFilter(v as QuizAttemptStatus | "ALL")}
          />
        </div>
      </Card>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load attempts" onRetry={load} />
        ) : attempts.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            heading="No attempts found"
            body="Try a different status filter."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Quiz
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Student
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Score
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Started
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {attempts.map((a) => (
                  <tr key={a.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-neutral-800">{a.quizTitle}</td>
                    <td className="px-4 py-3 text-neutral-600">{a.userEmail}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip tone={STATUS_TONE[a.status]}>{statusLabel(a.status)}</Chip>
                        {a.effectivelyExpired ? <Chip tone="danger">Expired</Chip> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {a.percentage !== null ? `${a.percentage}%` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                      {new Date(a.startedAt).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/assessment/attempts/${a.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}

export default function AttemptsPage() {
  return (
    <RequirePermission permission="quiz:attempts:read">
      <AttemptsContent />
    </RequirePermission>
  );
}
