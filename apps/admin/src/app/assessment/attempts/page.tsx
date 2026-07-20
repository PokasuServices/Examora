"use client";

import * as React from "react";
import Link from "next/link";
import type { AdminAttemptSummary, QuizAttemptStatus } from "@examora/types";
import { QUIZ_ATTEMPT_STATUSES } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { useAssessmentApi } from "@/lib/assessment-api";

const STATUS_FILTERS: (QuizAttemptStatus | "ALL")[] = ["ALL", ...QUIZ_ATTEMPT_STATUSES];

function AttemptsContent() {
  const api = useAssessmentApi();
  const [attempts, setAttempts] = React.useState<AdminAttemptSummary[]>([]);
  const [filter, setFilter] = React.useState<QuizAttemptStatus | "ALL">("ALL");

  React.useEffect(() => {
    api
      .listAttempts(filter === "ALL" ? undefined : { status: filter })
      .then((res) => setAttempts(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Attempt monitoring</h1>
        <Link href="/assessment/quizzes" className="text-sm text-primary-600 hover:underline">
          Quizzes →
        </Link>
      </div>

      <div className="mt-6 flex gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-md px-3 py-1 text-sm ${
              filter === s ? "bg-primary-600 text-white" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Quiz</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">{a.quizTitle}</td>
                <td className="px-4 py-3">{a.userEmail}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                    {a.status}
                    {a.effectivelyExpired ? " (expired)" : ""}
                  </span>
                </td>
                <td className="px-4 py-3">{a.percentage !== null ? `${a.percentage}%` : "—"}</td>
                <td className="px-4 py-3">{new Date(a.startedAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/assessment/attempts/${a.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {attempts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  No attempts.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
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
