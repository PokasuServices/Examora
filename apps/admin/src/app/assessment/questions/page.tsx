"use client";

import * as React from "react";
import Link from "next/link";
import { ApiError } from "@examora/auth-client";
import type { ContentStatus, Question, QuestionType } from "@examora/types";
import { QUESTION_TYPES } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { StatusBadge } from "@/components/status-badge";
import { useAssessmentApi } from "@/lib/assessment-api";

const STATUS_FILTERS: (ContentStatus | "ALL")[] = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"];

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
    <form
      onSubmit={create}
      className="mt-6 flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6"
    >
      <h2 className="text-lg font-semibold">New question</h2>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q-type">Type</Label>
          <select
            id="q-type"
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as QuestionType)}
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="q-text">Question text</Label>
        <textarea
          id="q-text"
          className="min-h-16 rounded-md border border-neutral-300 p-3 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="q-explanation">Explanation (shown in post-submit review)</Label>
        <textarea
          id="q-explanation"
          className="min-h-12 rounded-md border border-neutral-300 p-3 text-sm"
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
                onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
              >
                Remove
              </Button>
            ) : null}
          </div>
        ))}
        {options.length < 10 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOptions((prev) => [...prev, { text: "", isCorrect: false }])}
          >
            + Add option
          </Button>
        ) : null}
      </div>

      <FieldError>{error}</FieldError>
      <div>
        <Button type="submit">Create question</Button>
      </div>
    </form>
  );
}

function QuestionsContent() {
  const api = useAssessmentApi();
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [filter, setFilter] = React.useState<ContentStatus | "ALL">("ALL");

  const load = React.useCallback(() => {
    api
      .listQuestions(filter === "ALL" ? undefined : { status: filter })
      .then((res) => setQuestions(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Question bank</h1>
        <Link href="/assessment/quizzes">
          <Button variant="secondary">Manage quizzes</Button>
        </Link>
      </div>

      <CreateQuestionForm onCreated={load} />

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
              <th className="px-4 py-3 font-medium">Text</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Difficulty</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id} className="border-b border-neutral-100 last:border-0">
                <td className="max-w-md truncate px-4 py-3">{q.text}</td>
                <td className="px-4 py-3">{q.type}</td>
                <td className="px-4 py-3">{q.difficulty}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={q.status} />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/assessment/questions/${q.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
            {questions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No questions.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
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
