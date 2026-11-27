"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import { Button, FieldError, Input, Label } from "@examora/ui";
import {
  useStudentAdminApi,
  type CheckpointRow,
  type PracticeCategoryRow,
} from "@/lib/student-admin-api";
import { DeleteGate } from "@/components/delete-gate";

const SECTION =
  "rounded-md border border-neutral-200 p-4 dark:border-neutral-800 flex flex-col gap-4";

/**
 * Practice page categories (tabs) and course checkpoints for students.
 * Tests are put in a category from each quiz's "Student settings".
 */
export function CoursePracticeSettings({ courseId }: { courseId: string }) {
  const api = useStudentAdminApi();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const [categories, setCategories] = React.useState<PracticeCategoryRow[] | null>(null);
  const [checkpoints, setCheckpoints] = React.useState<CheckpointRow[] | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [cpTitle, setCpTitle] = React.useState("");
  const [cpDate, setCpDate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    apiRef.current
      .categories(courseId)
      .then(setCategories)
      .catch(() => setCategories([]));
    apiRef.current
      .checkpoints(courseId)
      .then(setCheckpoints)
      .catch(() => setCheckpoints([]));
  }, [courseId]);
  React.useEffect(() => load(), [load]);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <section className="mt-8 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Practice &amp; checkpoints</h2>
      <FieldError>{error}</FieldError>

      <div className={SECTION}>
        <h3 className="text-sm font-semibold">
          Practice categories (tabs on the student Practice page)
        </h3>
        {categories === null ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-neutral-500">No categories yet.</p>
        ) : (
          <ol className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {categories.map((c, i) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{c.title}</span>{" "}
                  <span className="text-xs text-neutral-500">{c.quizCount} tests</span>
                  {c.description ? (
                    <span className="block text-xs text-neutral-500">{c.description}</span>
                  ) : null}
                </span>
                <span className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={i === 0}
                    onClick={() =>
                      void run(() =>
                        api
                          .updateCategory(c.id, { position: Math.max(0, c.position - 1) })
                          .then(() =>
                            api.updateCategory(categories[i - 1]!.id, { position: c.position }),
                          ),
                      )
                    }
                  >
                    Up
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const next = window.prompt("Rename category", c.title);
                      if (next && next.trim())
                        void run(() => api.updateCategory(c.id, { title: next.trim() }));
                    }}
                  >
                    Rename
                  </Button>
                  <DeleteGate type={"practice-category"} id={c.id}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        window.confirm(
                          `Delete "${c.title}"? Its tests stay but are no longer listed.`,
                        ) && void run(() => api.deleteCategory(c.id))
                      }
                    >
                      Delete
                    </Button>
                  </DeleteGate>
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-title">New category</Label>
            <Input
              id="cat-title"
              placeholder="e.g. Mock tests"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-56"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-desc">Description (optional)</Label>
            <Input
              id="cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-72"
            />
          </div>
          <Button
            variant="outline"
            disabled={!title.trim()}
            onClick={() =>
              void run(async () => {
                await api.createCategory(courseId, {
                  title: title.trim(),
                  description: description.trim() || undefined,
                });
                setTitle("");
                setDescription("");
              })
            }
          >
            Add category
          </Button>
        </div>
      </div>

      <div className={SECTION}>
        <h3 className="text-sm font-semibold">Checkpoints (milestones students tick off)</h3>
        {checkpoints === null ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : checkpoints.length === 0 ? (
          <p className="text-sm text-neutral-500">No checkpoints yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {checkpoints.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  {c.title}{" "}
                  <span className="text-xs text-neutral-500">
                    {c.dueDate ? `due ${c.dueDate} · ` : ""}
                    {c.completedBy} done
                  </span>
                </span>
                <DeleteGate type={"checkpoint"} id={c.id}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void run(() => api.deleteCheckpoint(courseId, c.id))}
                  >
                    Delete
                  </Button>
                </DeleteGate>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-title">New checkpoint</Label>
            <Input
              id="cp-title"
              placeholder="Finish Mental Ability lessons"
              value={cpTitle}
              onChange={(e) => setCpTitle(e.target.value)}
              className="w-72"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-date">Due date (optional)</Label>
            <Input
              id="cp-date"
              type="date"
              value={cpDate}
              onChange={(e) => setCpDate(e.target.value)}
              className="w-44"
            />
          </div>
          <Button
            variant="outline"
            disabled={cpTitle.trim().length < 2}
            onClick={() =>
              void run(async () => {
                await api.createCheckpoint(courseId, {
                  title: cpTitle.trim(),
                  dueDate: cpDate || null,
                });
                setCpTitle("");
                setCpDate("");
              })
            }
          >
            Add checkpoint
          </Button>
        </div>
      </div>
    </section>
  );
}
