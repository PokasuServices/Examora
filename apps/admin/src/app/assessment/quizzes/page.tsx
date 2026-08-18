"use client";

import * as React from "react";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { ContentStatus, Quiz } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
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

const STATUS_FILTERS: (ContentStatus | "ALL")[] = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"];

const STATUS_TONE: Record<ContentStatus, ChipTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

function QuizzesContent() {
  const api = useAssessmentApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [quizzes, setQuizzes] = React.useState<Quiz[]>([]);
  const [filter, setFilter] = React.useState<ContentStatus | "ALL">("ALL");
  const [title, setTitle] = React.useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = React.useState("");
  const [passingScorePercent, setPassingScorePercent] = React.useState("40");
  const [negativeMarkingEnabled, setNegativeMarkingEnabled] = React.useState(false);
  const [negativeMarksPerWrong, setNegativeMarksPerWrong] = React.useState("0.25");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listQuizzes(filter === "ALL" ? undefined : { status: filter })
      .then((res) => {
        setQuizzes(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await api.createQuiz({
        title,
        timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : undefined,
        passingScorePercent: Number(passingScorePercent),
        negativeMarkingEnabled,
        negativeMarksPerWrong: negativeMarkingEnabled ? Number(negativeMarksPerWrong) : undefined,
      });
      setTitle("");
      setTimeLimitMinutes("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create quiz");
    }
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Quizzes"
        subtitle="Author quizzes, assign questions, and monitor results."
        actions={
          <>
            <Link href="/assessment/questions">
              <Button variant="secondary">Question bank</Button>
            </Link>
            <Link href="/assessment/attempts">
              <Button variant="secondary">Attempt monitoring</Button>
            </Link>
          </>
        }
      />

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">New quiz</h2>
        <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Quiz title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="timeLimit">Time limit (min)</Label>
            <Input
              id="timeLimit"
              type="number"
              min={1}
              value={timeLimitMinutes}
              onChange={(e) => setTimeLimitMinutes(e.target.value)}
              placeholder="Untimed"
              className="w-32"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="passingScore">Passing score %</Label>
            <Input
              id="passingScore"
              type="number"
              min={0}
              max={100}
              value={passingScorePercent}
              onChange={(e) => setPassingScorePercent(e.target.value)}
              className="w-28"
            />
          </div>
          <label className="flex h-10 items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={negativeMarkingEnabled}
              onChange={(e) => setNegativeMarkingEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            />
            Negative marking
          </label>
          {negativeMarkingEnabled ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="negMarks">Deduction fraction</Label>
              <Input
                id="negMarks"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={negativeMarksPerWrong}
                onChange={(e) => setNegativeMarksPerWrong(e.target.value)}
                className="w-28"
              />
            </div>
          ) : null}
          <Button type="submit">Create quiz</Button>
        </form>
        <FieldError>{error}</FieldError>
      </Card>

      <Card density="compact">
        <div className="max-w-xs">
          <SelectField
            id="quiz-status-filter"
            label="Status"
            value={filter}
            options={STATUS_FILTERS.map((s) => ({
              value: s,
              label: s === "ALL" ? "All statuses" : statusLabel(s),
            }))}
            onChange={(v) => setFilter(v as ContentStatus | "ALL")}
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
          <RetryInline message="Couldn't load quizzes" onRetry={load} />
        ) : quizzes.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            heading="No quizzes found"
            body="Try a different status filter, or create one above."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Title
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Time limit
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Negative marking
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {quizzes.map((quiz) => (
                  <tr key={quiz.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/assessment/quizzes/${quiz.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {quiz.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "Untimed"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {quiz.negativeMarkingEnabled
                        ? `${quiz.negativeMarksPerWrong}× per wrong`
                        : "No"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Chip tone={STATUS_TONE[quiz.status]}>{statusLabel(quiz.status)}</Chip>
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

export default function QuizzesPage() {
  return (
    <RequirePermission permission="quiz:manage">
      <QuizzesContent />
    </RequirePermission>
  );
}
