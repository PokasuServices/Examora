"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@examora/auth-client";
import type { ContentStatus, Question } from "@examora/types";
import { Button, FieldError, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { StatusActions } from "@/components/status-actions";
import { StatusBadge } from "@/components/status-badge";
import { useAssessmentApi } from "@/lib/assessment-api";

function QuestionDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useAssessmentApi();
  const [question, setQuestion] = React.useState<Question | null>(null);
  const [text, setText] = React.useState("");
  const [explanation, setExplanation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .getQuestion(id)
      .then((q) => {
        setQuestion(q);
        setText(q.text);
        setExplanation(q.explanation ?? "");
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load"));
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

  async function changeStatus(status: ContentStatus): Promise<void> {
    setError(null);
    try {
      setQuestion(await api.setQuestionStatus(id, status));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status change failed");
    }
  }

  async function remove(): Promise<void> {
    setError(null);
    try {
      await api.deleteQuestion(id);
      router.push("/assessment/questions");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  if (!question) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
        <FieldError>{error}</FieldError>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/assessment/questions" className="hover:underline">
          Question bank
        </Link>{" "}
        · <span className="text-neutral-800">{question.type}</span>
      </nav>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-heading">{question.type}</h1>
          <StatusBadge status={question.status} />
        </div>
        <StatusActions status={question.status} onChange={(s) => void changeStatus(s)} />
      </div>

      <form
        onSubmit={saveDetails}
        className="mt-6 flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="text">Question text</Label>
          <textarea
            id="text"
            className="min-h-16 rounded-md border border-neutral-300 p-3 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="explanation">Explanation</Label>
          <textarea
            id="explanation"
            className="min-h-12 rounded-md border border-neutral-300 p-3 text-sm"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
        </div>
        <FieldError>{error}</FieldError>
        {saved ? <p className="text-sm text-success-600">Saved.</p> : null}
        <div>
          <Button type="submit">Save details</Button>
        </div>
      </form>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Options</h2>
        <ul className="mt-3 space-y-1.5">
          {question.options.map((o) => (
            <li
              key={o.id}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                o.isCorrect ? "border-success-600 bg-success-500/10" : "border-neutral-200"
              }`}
            >
              {o.text} {o.isCorrect ? "— correct" : ""}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-neutral-500">
          To change options, edit via the question bank list — options are not editable inline here
          this sprint.
        </p>
      </section>

      <div className="mt-6">
        <Button variant="ghost" onClick={() => void remove()}>
          Delete question
        </Button>
      </div>
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
