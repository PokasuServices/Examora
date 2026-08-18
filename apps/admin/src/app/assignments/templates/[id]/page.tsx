"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { AssignmentTemplate, RubricSkeletonItem } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssignmentAdminApi } from "@/lib/assignment-api";

function TemplateDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useAssignmentAdminApi();
  const [loadStatus, setLoadStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [template, setTemplate] = React.useState<AssignmentTemplate | null>(null);
  const [title, setTitle] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [marksTotal, setMarksTotal] = React.useState("");
  const [maxFileSizeMb, setMaxFileSizeMb] = React.useState("");
  const [maxFiles, setMaxFiles] = React.useState("");
  const [rubric, setRubric] = React.useState<RubricSkeletonItem[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(() => {
    setLoadStatus("loading");
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
        setLoadStatus("ready");
      })
      .catch(() => setLoadStatus("error"));
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
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  }

  async function remove(): Promise<void> {
    setError(null);
    setDeleting(true);
    try {
      await api.deleteTemplate(id);
      router.push("/assignments/templates");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete template");
      setDeleting(false);
    }
  }

  if (loadStatus === "loading") {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32" />
        <Card>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-4 h-32 w-full" />
        </Card>
      </main>
    );
  }

  if (loadStatus === "error" || !template) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <RetryInline message="Couldn't load this template" onRetry={load} />
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/assignments/templates"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Templates
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-bold text-neutral-900">{template.title}</h1>
      </div>

      <FieldError>{error}</FieldError>

      <Card>
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
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
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brief">Brief</Label>
            <textarea
              id="brief"
              className="min-h-24 w-full rounded-md border border-neutral-300 p-3 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>

          <div>
            <Label>Rubric skeleton</Label>
            <div className="mt-2 flex flex-col gap-2">
              {rubric.map((item, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
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

          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
          Delete template
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this template?"
        message="Assignments already created from this template are not affected. This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        submitting={deleting}
        error={error}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
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
