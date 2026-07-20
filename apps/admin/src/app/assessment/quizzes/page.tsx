"use client";

import * as React from "react";
import Link from "next/link";
import { ApiError } from "@examora/auth-client";
import type { ContentStatus, Quiz } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { StatusBadge } from "@/components/status-badge";
import { useAssessmentApi } from "@/lib/assessment-api";

const STATUS_FILTERS: (ContentStatus | "ALL")[] = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"];

function QuizzesContent() {
  const api = useAssessmentApi();
  const [quizzes, setQuizzes] = React.useState<Quiz[]>([]);
  const [filter, setFilter] = React.useState<ContentStatus | "ALL">("ALL");
  const [title, setTitle] = React.useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = React.useState("");
  const [passingScorePercent, setPassingScorePercent] = React.useState("40");
  const [negativeMarkingEnabled, setNegativeMarkingEnabled] = React.useState(false);
  const [negativeMarksPerWrong, setNegativeMarksPerWrong] = React.useState("0.25");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .listQuizzes(filter === "ALL" ? undefined : { status: filter })
      .then((res) => setQuizzes(res.items))
      .catch(() => undefined);
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
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Quizzes</h1>
        <div className="flex gap-2">
          <Link href="/assessment/questions">
            <Button variant="secondary">Question bank</Button>
          </Link>
          <Link href="/assessment/attempts">
            <Button variant="secondary">Attempt monitoring</Button>
          </Link>
        </div>
      </div>

      <form
        onSubmit={create}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
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
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={negativeMarkingEnabled}
            onChange={(e) => setNegativeMarkingEnabled(e.target.checked)}
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
            />
          </div>
        ) : null}
        <Button type="submit">Create quiz</Button>
      </form>
      <FieldError>{error}</FieldError>

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
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Time limit</th>
              <th className="px-4 py-3 font-medium">Negative marking</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {quizzes.map((quiz) => (
              <tr key={quiz.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/assessment/quizzes/${quiz.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    {quiz.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "Untimed"}
                </td>
                <td className="px-4 py-3">
                  {quiz.negativeMarkingEnabled ? `${quiz.negativeMarksPerWrong}× per wrong` : "No"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={quiz.status} />
                </td>
              </tr>
            ))}
            {quizzes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                  No quizzes.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
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
