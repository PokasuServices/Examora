"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { AssignmentDetail, ContentStatus } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { StatusActions } from "@/components/status-actions";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { useAssignmentAdminApi } from "@/lib/assignment-api";

const STATUS_TONE: Record<ContentStatus, ChipTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

type PendingAction =
  | { kind: "status"; next: ContentStatus }
  | { kind: "delete" }
  | { kind: "removeCriterion"; criterionId: string; title: string }
  | null;

function AssignmentDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useAssignmentAdminApi();
  const [loadStatus, setLoadStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [assignment, setAssignment] = React.useState<AssignmentDetail | null>(null);
  const [title, setTitle] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [marksTotal, setMarksTotal] = React.useState("");
  const [criterionTitle, setCriterionTitle] = React.useState("");
  const [criterionMaxMarks, setCriterionMaxMarks] = React.useState("10");
  const [saving, setSaving] = React.useState(false);
  const [addingCriterion, setAddingCriterion] = React.useState(false);
  const [pending, setPending] = React.useState<PendingAction>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoadStatus("loading");
    api
      .getAssignment(id)
      .then((a) => {
        setAssignment(a);
        setTitle(a.title);
        setBrief(a.brief);
        setMarksTotal(String(a.marksTotal));
        setLoadStatus("ready");
      })
      .catch(() => setLoadStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function saveDetails(): Promise<void> {
    setError(null);
    setSaving(true);
    try {
      await api.updateAssignment(id, { title, brief, marksTotal: Number(marksTotal) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  async function addCriterion(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setAddingCriterion(true);
    try {
      await api.addCriterion(id, { title: criterionTitle, maxMarks: Number(criterionMaxMarks) });
      setCriterionTitle("");
      setCriterionMaxMarks("10");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add criterion");
    } finally {
      setAddingCriterion(false);
    }
  }

  async function confirmPending(): Promise<void> {
    if (!pending) return;
    setError(null);
    setSubmitting(true);
    try {
      if (pending.kind === "status") {
        await api.setAssignmentStatus(id, pending.next);
        setPending(null);
        load();
      } else if (pending.kind === "delete") {
        await api.deleteAssignment(id);
        router.push("/assignments");
        return;
      } else {
        await api.removeCriterion(id, pending.criterionId);
        setPending(null);
        load();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
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

  if (loadStatus === "error" || !assignment) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <RetryInline message="Couldn't load this assignment" onRetry={load} />
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/assignments"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Assignments
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-neutral-900">{assignment.title}</h1>
          <Chip tone={STATUS_TONE[assignment.status]}>{statusLabel(assignment.status)}</Chip>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusActions
          status={assignment.status}
          onChange={(next) => setPending({ kind: "status", next })}
        />
        <Link href={`/assignments/submissions?assignmentId=${assignment.id}`}>
          <Button variant="secondary">Submissions</Button>
        </Link>
      </div>

      <FieldError>{error}</FieldError>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Details</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveDetails();
          }}
          className="mt-4 flex flex-col gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brief">Brief</Label>
            <textarea
              id="brief"
              className="min-h-24 w-full rounded-md border border-neutral-300 p-3 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onBlur={() => void saveDetails()}
            />
          </div>
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Card>

      <Card density="compact">
        <h2 className="font-heading text-base font-semibold text-neutral-900">Rubric criteria</h2>
        <form
          onSubmit={(e) => void addCriterion(e)}
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="criterionTitle">Title</Label>
            <Input
              id="criterionTitle"
              value={criterionTitle}
              onChange={(e) => setCriterionTitle(e.target.value)}
              className="w-64"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="criterionMaxMarks">Max marks</Label>
            <Input
              id="criterionMaxMarks"
              type="number"
              min={0.01}
              step={0.01}
              value={criterionMaxMarks}
              onChange={(e) => setCriterionMaxMarks(e.target.value)}
              className="w-24"
            />
          </div>
          <Button type="submit" disabled={addingCriterion || !criterionTitle.trim()}>
            {addingCriterion ? "Adding…" : "Add criterion"}
          </Button>
        </form>

        {assignment.criteria.length > 0 ? (
          <ul className="mt-4 flex flex-col divide-y divide-neutral-100">
            {assignment.criteria.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-neutral-700">
                  {c.title} <span className="text-neutral-400">({c.maxMarks} marks)</span>
                </span>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setPending({ kind: "removeCriterion", criterionId: c.id, title: c.title })
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">
            No criteria yet — at least one is required before publishing.
          </p>
        )}
      </Card>

      <div>
        <Button variant="ghost" onClick={() => setPending({ kind: "delete" })}>
          Delete assignment
        </Button>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === "status"
            ? "Change assignment status?"
            : pending?.kind === "delete"
              ? "Delete this assignment?"
              : "Remove this criterion?"
        }
        message={
          pending?.kind === "status" ? (
            <>
              Change status from{" "}
              <span className="font-medium text-neutral-800">{statusLabel(assignment.status)}</span>{" "}
              to <span className="font-medium text-neutral-800">{statusLabel(pending.next)}</span>?
            </>
          ) : pending?.kind === "delete" ? (
            "This permanently deletes the assignment, its rubric criteria, and cannot be undone."
          ) : pending?.kind === "removeCriterion" ? (
            <>
              Remove <span className="font-medium text-neutral-800">{pending.title}</span> from the
              rubric?
            </>
          ) : null
        }
        confirmLabel={
          pending?.kind === "status"
            ? "Change status"
            : pending?.kind === "delete"
              ? "Delete"
              : "Remove"
        }
        tone={
          pending?.kind === "delete" || pending?.kind === "removeCriterion" ? "danger" : "primary"
        }
        submitting={submitting}
        error={error}
        onConfirm={() => void confirmPending()}
        onCancel={() => setPending(null)}
      />
    </main>
  );
}

export default function AssignmentDetailPage() {
  return (
    <RequirePermission permission="assignment:manage">
      <AssignmentDetailContent />
    </RequirePermission>
  );
}
