"use client";

import * as React from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { ContentStatus, Question, QuestionType } from "@examora/types";
import { QUESTION_TYPES } from "@examora/types";
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

interface OptionDraft {
  text: string;
  isCorrect: boolean;
}

function CreateQuestionForm({ onCreated }: { onCreated: () => void }) {
  const api = useAssessmentApi();
  const [type, setType] = React.useState<QuestionType>("SINGLE_CHOICE");
  const [text, setText] = React.useState("");
  const [explanation, setExplanation] = React.useState("");
  const [options, setOptions] = React.useState<OptionDraft[]>([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ]);
  const [error, setError] = React.useState<string | null>(null);

  function setOptionText(index: number, value: string): void {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text: value } : o)));
  }

  function setOptionCorrect(index: number, value: boolean): void {
    setOptions((prev) =>
      prev.map((o, i) =>
        type === "SINGLE_CHOICE" || type === "TRUE_FALSE"
          ? { ...o, isCorrect: i === index ? value : false } // single-answer types: one at a time
          : i === index
            ? { ...o, isCorrect: value }
            : o,
      ),
    );
  }

  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await api.createQuestion({
        type,
        text,
        explanation: explanation || undefined,
        options: options.filter((o) => o.text.trim().length > 0),
      });
      setText("");
      setExplanation("");
      setOptions([
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
      ]);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create question");
    }
  }

  return (
    <Card>
      <h2 className="font-heading text-base font-semibold text-neutral-900">New question</h2>
      <form onSubmit={create} className="mt-4 flex flex-col gap-4">
        <div className="w-full sm:w-56">
          <SelectField
            id="q-type"
            label="Type"
            value={type}
            options={QUESTION_TYPES.map((t) => ({ value: t, label: statusLabel(t) }))}
            onChange={(v) => setType(v as QuestionType)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q-text">Question text</Label>
          <textarea
            id="q-text"
            className="min-h-16 rounded-md border border-neutral-300 bg-white p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q-explanation">Explanation (shown in post-submit review)</Label>
          <textarea
            id="q-explanation"
            className="min-h-12 rounded-md border border-neutral-300 bg-white p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Options (mark the correct one{type === "MULTIPLE_CHOICE" ? "s" : ""})</Label>
          {options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                name="correct-option"
                checked={option.isCorrect}
                onChange={(e) => setOptionCorrect(i, e.target.checked)}
                className={`h-4 w-4 border-neutral-300 text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  type === "MULTIPLE_CHOICE" ? "rounded" : "rounded-full"
                }`}
              />
              <Input
                value={option.text}
                onChange={(e) => setOptionText(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
              />
              {options.length > 2 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          {options.length < 10 ? (
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOptions((prev) => [...prev, { text: "", isCorrect: false }])}
              >
                + Add option
              </Button>
            </div>
          ) : null}
        </div>

        <FieldError>{error}</FieldError>
        <div>
          <Button type="submit">Create question</Button>
        </div>
      </form>
    </Card>
  );
}

function QuestionsContent() {
  const api = useAssessmentApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [filter, setFilter] = React.useState<ContentStatus | "ALL">("ALL");

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listQuestions(filter === "ALL" ? undefined : { status: filter })
      .then((res) => {
        setQuestions(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Question bank"
        subtitle="Author reusable questions and publish them for use in quizzes."
        actions={
          <Link href="/assessment/quizzes">
            <Button variant="secondary">Manage quizzes</Button>
          </Link>
        }
      />

      <CreateQuestionForm onCreated={load} />

      <Card density="compact">
        <div className="max-w-xs">
          <SelectField
            id="question-status-filter"
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
          <RetryInline message="Couldn't load questions" onRetry={load} />
        ) : questions.length === 0 ? (
          <EmptyState
            icon={HelpCircle}
            heading="No questions found"
            body="Try a different status filter, or create one above."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Text
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Type
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Difficulty
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {questions.map((q) => (
                  <tr key={q.id} className="hover:bg-neutral-50">
                    <td className="max-w-md truncate px-4 py-3 text-neutral-800">{q.text}</td>
                    <td className="px-4 py-3 text-neutral-600">{statusLabel(q.type)}</td>
                    <td className="px-4 py-3 text-neutral-600">{statusLabel(q.difficulty)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Chip tone={STATUS_TONE[q.status]}>{statusLabel(q.status)}</Chip>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/assessment/questions/${q.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        Manage
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

export default function QuestionsPage() {
  return (
    <RequirePermission permission="question:manage">
      <QuestionsContent />
    </RequirePermission>
  );
}
