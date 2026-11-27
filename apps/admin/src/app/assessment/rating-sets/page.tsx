"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { SketchRubricView } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useStudentAdminApi } from "@/lib/student-admin-api";
import { DeleteGate } from "@/components/delete-gate";

type FactorDraft = { title: string; description: string };
const blank = (): FactorDraft => ({ title: "", description: "" });

/** Create or edit one rating set: a name and its factors, each with what it means. */
function RubricForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: SketchRubricView;
  onSave: (body: {
    title: string;
    factors: { title: string; description: string | null }[];
  }) => Promise<void>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [factors, setFactors] = React.useState<FactorDraft[]>(
    initial
      ? initial.factors.map((f) => ({ title: f.title, description: f.description ?? "" }))
      : [blank(), blank(), blank()],
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const formId = React.useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = factors
      .map((f) => ({ title: f.title.trim(), description: f.description.trim() || null }))
      .filter((f) => f.title);
    if (title.trim().length < 2) return setError("Give the set a name.");
    if (clean.length === 0) return setError("Add at least one factor.");
    setSaving(true);
    setError(null);
    try {
      await onSave({ title: title.trim(), factors: clean });
      if (!initial) {
        setTitle("");
        setFactors([blank(), blank(), blank()]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 sm:max-w-md">
        <Label htmlFor={`${formId}-title`}>Set name</Label>
        <Input
          id={`${formId}-title`}
          placeholder="e.g. Observation drawing"
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <ol className="flex flex-col gap-2">
        {factors.map((f, i) => (
          <li key={i} className="grid gap-2 sm:grid-cols-[14rem_1fr_auto] sm:items-center">
            <Input
              aria-label={`Factor ${i + 1} name`}
              placeholder={`Factor ${i + 1}`}
              maxLength={80}
              value={f.title}
              onChange={(e) =>
                setFactors((p) => p.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
              }
            />
            <Input
              aria-label={`Factor ${i + 1} description`}
              placeholder="What students and reviewers should look for"
              maxLength={300}
              value={f.description}
              onChange={(e) =>
                setFactors((p) =>
                  p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)),
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={factors.length === 1}
              onClick={() => setFactors((p) => p.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {factors.length < 12 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFactors((p) => [...p, blank()])}
          >
            Add factor
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save changes" : "Create set"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
      <FieldError>{error}</FieldError>
    </form>
  );
}

function RatingSetsContent() {
  const api = useStudentAdminApi();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const [rows, setRows] = React.useState<SketchRubricView[] | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiRef.current
      .rubrics()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Rating sets"
        subtitle="Named sets of factors that sketch questions are rated on, by the student, classmates and reviewers. Pick a set in the question editor."
      />
      <Card>
        <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">
          New rating set
        </h2>
        <div className="mt-4">
          <RubricForm onSave={async (body) => setRows(await api.createRubric(body))} />
        </div>
      </Card>
      <FieldError>{error}</FieldError>
      {rows === null ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            heading="No rating sets yet"
            body="Create one above, then choose it on a sketch question."
          />
        </Card>
      ) : (
        rows.map((r) => (
          <Card key={r.id}>
            {editing === r.id ? (
              <RubricForm
                initial={r}
                onCancel={() => setEditing(null)}
                onSave={async (body) => {
                  setRows(await api.updateRubric(r.id, body));
                  setEditing(null);
                }}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">
                    {r.title}{" "}
                    <span className="text-sm font-normal text-neutral-500">
                      · {r.factors.length} factors · used by {r.questionCount} question
                      {r.questionCount === 1 ? "" : "s"}
                    </span>
                  </h2>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r.id)}>
                      Edit
                    </Button>
                    <DeleteGate type={"rubric"} id={r.id}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Delete "${r.title}"? Its questions keep their current criteria.`,
                            )
                          )
                            return;
                          try {
                            await api.deleteRubric(r.id);
                            setRows((p) => (p ?? []).filter((x) => x.id !== r.id));
                          } catch (err) {
                            setError(err instanceof ApiError ? err.message : "Couldn't delete");
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </DeleteGate>
                  </div>
                </div>
                <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
                  {r.factors.map((f) => (
                    <li key={f.title}>
                      <span className="font-medium">{f.title}</span>
                      {f.description ? (
                        <span className="text-neutral-500"> · {f.description}</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Card>
        ))
      )}
    </main>
  );
}

export default function RatingSetsPage() {
  return (
    <RequirePermission permission="assignment:review">
      <RatingSetsContent />
    </RequirePermission>
  );
}
