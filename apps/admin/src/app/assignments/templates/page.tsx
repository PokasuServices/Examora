"use client";

import * as React from "react";
import Link from "next/link";
import { LayoutTemplate } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { AssignmentTemplate, RubricSkeletonItem } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import { useAssignmentAdminApi } from "@/lib/assignment-api";

function emptyItem(): RubricSkeletonItem {
  return { title: "", maxMarks: 10 };
}

function TemplatesContent() {
  const api = useAssignmentAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [templates, setTemplates] = React.useState<AssignmentTemplate[]>([]);
  const [title, setTitle] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [marksTotal, setMarksTotal] = React.useState("100");
  const [maxFileSizeMb, setMaxFileSizeMb] = React.useState("20");
  const [maxFiles, setMaxFiles] = React.useState("5");
  const [rubric, setRubric] = React.useState<RubricSkeletonItem[]>([emptyItem()]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AssignmentTemplate | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listTemplates()
      .then((res) => {
        setTemplates(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
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
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    setError(null);
    setDeleting(true);
    try {
      await api.deleteTemplate(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete template");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Assignment templates"
        subtitle="Reusable briefs, file rules, and rubric skeletons — copied into a new assignment at creation time (later edits to the template do not affect assignments already created from it)."
        actions={
          <Link href="/assignments">
            <Button variant="secondary">Assignments</Button>
          </Link>
        }
      />

      <form
        onSubmit={(e) => void create(e)}
        className="flex flex-col gap-4 rounded-md border border-neutral-100 bg-neutral-50/50 p-4"
      >
        <h3 className="font-heading text-sm font-semibold text-neutral-900">New template</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
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
            required
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

        <FieldError>{error}</FieldError>
        <div>
          <Button type="submit" disabled={submitting || !title.trim() || !brief.trim()}>
            {submitting ? "Creating…" : "Create template"}
          </Button>
        </div>
      </form>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load templates" onRetry={load} />
        ) : templates.length === 0 ? (
          <EmptyState
            icon={LayoutTemplate}
            heading="No templates yet"
            body="Create the first one above."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Title
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Marks
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Rubric items
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/assignments/templates/${t.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{t.marksTotal}</td>
                    <td className="px-4 py-3 text-neutral-600">{t.rubric.length}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" onClick={() => setDeleteTarget(t)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this template?"
        message={
          deleteTarget ? (
            <>
              Delete <span className="font-medium text-neutral-800">{deleteTarget.title}</span>?
              Assignments already created from it are not affected.
            </>
          ) : null
        }
        confirmLabel="Delete"
        tone="danger"
        submitting={deleting}
        error={error}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
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
