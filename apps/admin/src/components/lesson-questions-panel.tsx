"use client";

import * as React from "react";
import { ApiError, useAuth } from "@examora/auth-client";
import type { AdminLessonQuestion, PaginatedData, Question } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";

const TYPE_LABEL: Record<string, string> = {
  SINGLE_CHOICE: "Single choice",
  MULTIPLE_CHOICE: "Multiple choice",
  TRUE_FALSE: "True / false",
  NUMERIC: "Numeric",
};

/**
 * Questions shown inside a lesson (past-paper examples). Students answer each
 * once in the lesson and then see the explanation. Sketch questions can't be used.
 */
export function LessonQuestionsPanel({ lessonId }: { lessonId: string }) {
  const { request } = useAuth();
  const requestRef = React.useRef(request);
  requestRef.current = request;
  const base = `/admin/content/lessons/${lessonId}/questions`;
  const [items, setItems] = React.useState<AdminLessonQuestion[] | null>(null);
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<Question[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    requestRef
      .current<AdminLessonQuestion[]>(base, { method: "GET" })
      .then(setItems)
      .catch(() => setItems([]));
  }, [base]);
  React.useEffect(() => load(), [load]);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ search: search.trim(), pageSize: "20" });
      const res = await request<PaginatedData<Question>>(
        `/admin/assessment/questions?${qs.toString()}`,
        { method: "GET" },
      );
      setResults(res.items.filter((q) => q.type !== "UPLOAD"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  const attached = new Set(items?.map((i) => i.questionId) ?? []);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
      <div>
        <p className="text-sm font-semibold">Questions inside this lesson</p>
        <p className="text-xs text-neutral-500">
          Students answer each once while reading, then see the answer and explanation.
        </p>
      </div>
      {items === null ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-500">None yet.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {items.map((q, i) => (
            <li key={q.id} className="flex items-start justify-between gap-2 text-sm">
              <span>
                <span className="text-neutral-500">{i + 1}.</span> {q.text}{" "}
                <span className="text-xs text-neutral-500">({TYPE_LABEL[q.type] ?? q.type})</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void run(() => request<void>(`${base}/${q.id}`, { method: "DELETE" }))
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={(e) => void find(e)} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`lq-search-${lessonId}`}>Find a question</Label>
          <Input
            id={`lq-search-${lessonId}`}
            placeholder="Words from the question"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72"
          />
        </div>
        <Button type="submit" variant="outline" disabled={searching || !search.trim()}>
          {searching ? "Searching…" : "Search"}
        </Button>
      </form>
      <FieldError>{error}</FieldError>
      {results !== null ? (
        results.length === 0 ? (
          <p className="text-sm text-neutral-500">No matching questions.</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {results.map((q) => (
              <li key={q.id} className="flex items-start justify-between gap-2 text-sm">
                <span>
                  {q.text}{" "}
                  <span className="text-xs text-neutral-500">
                    ({TYPE_LABEL[q.type] ?? q.type}
                    {q.status !== "PUBLISHED" ? `, ${q.status.toLowerCase()}` : ""})
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={attached.has(q.id)}
                  onClick={() =>
                    void run(() => request(base, { method: "POST", body: { questionId: q.id } }))
                  }
                >
                  {attached.has(q.id) ? "Added" : "Add"}
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
