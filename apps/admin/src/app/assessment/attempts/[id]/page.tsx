"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { AdminAttemptDetail } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { useAssessmentApi } from "@/lib/assessment-api";

function AttemptDetailContent() {
  const { id } = useParams<{ id: string }>();
  const api = useAssessmentApi();
  const [attempt, setAttempt] = React.useState<AdminAttemptDetail | null>(null);

  React.useEffect(() => {
    api
      .getAttempt(id)
      .then(setAttempt)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!attempt) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/assessment/attempts" className="hover:underline">
          Attempt monitoring
        </Link>{" "}
        · <span className="text-neutral-800">{attempt.quizTitle}</span>
      </nav>

      <h1 className="text-heading">{attempt.quizTitle}</h1>
      <p className="mt-1 text-sm text-neutral-500">{attempt.userEmail}</p>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-neutral-500">Status</dt>
          <dd className="font-medium">{attempt.status}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Marks</dt>
          <dd className="font-medium">
            {attempt.obtainedMarks ?? "—"} / {attempt.totalMarks}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Percentage</dt>
          <dd className="font-medium">
            {attempt.percentage !== null ? `${attempt.percentage}%` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Passed</dt>
          <dd className="font-medium">
            {attempt.passed === null ? "—" : attempt.passed ? "Yes" : "No"}
          </dd>
        </div>
      </dl>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-700">Answers</h2>
        <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {attempt.answers.map((a) => (
            <li key={a.questionId} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="max-w-md truncate">{a.questionText}</span>
                <span
                  className={
                    a.isCorrect === true
                      ? "text-success-600"
                      : a.isCorrect === false
                        ? "text-error-600"
                        : "text-neutral-500"
                  }
                >
                  {a.isCorrect === true
                    ? "Correct"
                    : a.isCorrect === false
                      ? "Wrong"
                      : "Unanswered"}
                  {a.marksAwarded !== null ? ` (${a.marksAwarded})` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
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
