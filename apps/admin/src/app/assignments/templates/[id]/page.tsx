"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@examora/auth-client";
import type { AssignmentTemplate, RubricSkeletonItem } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { useAssignmentAdminApi } from "@/lib/assignment-api";

function TemplateDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useAssignmentAdminApi();
  const [template, setTemplate] = React.useState<AssignmentTemplate | null>(null);
  const [title, setTitle] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [marksTotal, setMarksTotal] = React.useState("");
  const [maxFileSizeMb, setMaxFileSizeMb] = React.useState("");
  const [maxFiles, setMaxFiles] = React.useState("");
  const [rubric, setRubric] = React.useState<RubricSkeletonItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .getTemplate(id)
      .then((t) => {
        setTemplate(t);
        setTitle(t.title);
        setBrief(t.brief);
        setMarksTotal(String(t.marksTotal));
        setMaxFileSizeMb(String(t.fileRules.maxFileSizeMb));
        setMaxFiles(String(t.fileRules.maxFiles));
        setRubric(t.rubric);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  function updateRubricItem(index: number, patch: Partial<RubricSkeletonItem>): void {
    setRubric((items) => items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await api.updateTemplate(id, {
        title,
        brief,
        marksTotal: Number(marksTotal),
        fileRules: {
          allowedMimeTypes: template?.fileRules.allowedMimeTypes ?? [
            "image/png",
            "image/jpeg",
            "application/pdf",
          ],
          maxFileSizeMb: Number(maxFileSizeMb),
          maxFiles: Number(maxFiles),
        },
        rubric: rubric.filter((r) => r.title.trim().length > 0),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes");
    }
  }

  async function remove(): Promise<void> {
    setError(null);
    try {
      await api.deleteTemplate(id);
      router.push("/assignments/templates");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete template");
    }
  }

  if (!template) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
        <FieldError>{error}</FieldError>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/assignments/templates" className="hover:underline">
          Templates
        </Link>{" "}
        · <span className="text-neutral-800">{template.title}</span>
      </nav>

      <h1 className="text-heading">{template.title}</h1>
      <FieldError>{error}</FieldError>

      <form onSubmit={save} className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-64"
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
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              className="w-fit"
              onClick={() => setRubric((items) => [...items, { title: "", maxMarks: 10 }])}
            >
              Add criterion row
            </Button>
          </div>
        </div>

        <Button type="submit" className="mt-4">
          Save changes
        </Button>
      </form>

      <div className="mt-6">
        <Button variant="ghost" onClick={() => void remove()}>
          Delete template
        </Button>
      </div>
    </main>
  );
}

export default function TemplateDetailPage() {
  return (
    <RequirePermission permission="assignment:manage">
      <TemplateDetailContent />
    </RequirePermission>
  );
}
