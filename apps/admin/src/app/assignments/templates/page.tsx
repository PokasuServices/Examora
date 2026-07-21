"use client";

import * as React from "react";
import Link from "next/link";
import { ApiError } from "@examora/auth-client";
import type { AssignmentTemplate, RubricSkeletonItem } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { useAssignmentAdminApi } from "@/lib/assignment-api";

function emptyItem(): RubricSkeletonItem {
  return { title: "", maxMarks: 10 };
}

function TemplatesContent() {
  const api = useAssignmentAdminApi();
  const [templates, setTemplates] = React.useState<AssignmentTemplate[]>([]);
  const [title, setTitle] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [marksTotal, setMarksTotal] = React.useState("100");
  const [maxFileSizeMb, setMaxFileSizeMb] = React.useState("20");
  const [maxFiles, setMaxFiles] = React.useState("5");
  const [rubric, setRubric] = React.useState<RubricSkeletonItem[]>([emptyItem()]);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .listTemplates()
      .then((res) => setTemplates(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function updateRubricItem(index: number, patch: Partial<RubricSkeletonItem>): void {
    setRubric((items) => items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await api.createTemplate({
        title,
        brief,
        marksTotal: Number(marksTotal),
        fileRules: {
          allowedMimeTypes: ["image/png", "image/jpeg", "application/pdf"],
          maxFileSizeMb: Number(maxFileSizeMb),
          maxFiles: Number(maxFiles),
        },
        rubric: rubric.filter((r) => r.title.trim().length > 0),
      });
      setTitle("");
      setBrief("");
      setRubric([emptyItem()]);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create template");
    }
  }

  async function remove(id: string): Promise<void> {
    setError(null);
    try {
      await api.deleteTemplate(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete template");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Assignment templates</h1>
        <Link href="/assignments" className="text-sm text-primary-600 hover:underline">
          Assignments →
        </Link>
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        Reusable briefs, file rules, and rubric skeletons — copied into a new assignment at creation
        time (later edits to the template do not affect assignments already created from it).
      </p>

      <form onSubmit={create} className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-64"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marksTotal">Marks total</Label>
            <Input
              id="marksTotal"
              type="number"
              min={0.01}
              step={0.01}
              value={marksTotal}
              onChange={(e) => setMarksTotal(e.target.value)}
              className="w-28"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxFileSizeMb">Max file size (MB)</Label>
            <Input
              id="maxFileSizeMb"
              type="number"
              min={1}
              max={500}
              value={maxFileSizeMb}
              onChange={(e) => setMaxFileSizeMb(e.target.value)}
              className="w-28"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxFiles">Max files</Label>
            <Input
              id="maxFiles"
              type="number"
              min={1}
              max={20}
              value={maxFiles}
              onChange={(e) => setMaxFiles(e.target.value)}
              className="w-24"
            />
          </div>
        </div>

        <div className="mt-3">
          <Label htmlFor="brief">Brief</Label>
          <textarea
            id="brief"
            className="mt-1.5 min-h-24 w-full rounded-md border border-neutral-300 p-3 text-sm"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            required
          />
        </div>

        <div className="mt-4">
          <Label>Rubric skeleton</Label>
          <div className="mt-2 flex flex-col gap-2">
            {rubric.map((item, i) => (
              <div key={i} className="flex items-end gap-2">
                <Input
                  placeholder="Criterion title"
                  value={item.title}
                  onChange={(e) => updateRubricItem(i, { title: e.target.value })}
                  className="w-64"
                />
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  placeholder="Max marks"
                  value={item.maxMarks}
                  onChange={(e) => updateRubricItem(i, { maxMarks: Number(e.target.value) })}
                  className="w-28"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRubric((items) => items.filter((_, idx) => idx !== i))}
                  disabled={rubric.length <= 1}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              className="w-fit"
              onClick={() => setRubric((items) => [...items, emptyItem()])}
            >
              Add criterion row
            </Button>
          </div>
        </div>

        <Button type="submit" className="mt-4">
          Create template
        </Button>
      </form>
      <FieldError>{error}</FieldError>

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Marks</th>
              <th className="px-4 py-3 font-medium">Rubric items</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/assignments/templates/${t.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    {t.title}
                  </Link>
                </td>
                <td className="px-4 py-3">{t.marksTotal}</td>
                <td className="px-4 py-3">{t.rubric.length}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" onClick={() => void remove(t.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {templates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                  No templates.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function TemplatesPage() {
  return (
    <RequirePermission permission="assignment:manage">
      <TemplatesContent />
    </RequirePermission>
  );
}
