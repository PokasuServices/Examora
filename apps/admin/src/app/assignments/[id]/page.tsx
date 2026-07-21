"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@examora/auth-client";
import type { AssignmentDetail, ContentStatus } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { StatusActions } from "@/components/status-actions";
import { StatusBadge } from "@/components/status-badge";
import { useAssignmentAdminApi } from "@/lib/assignment-api";

function AssignmentDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useAssignmentAdminApi();
  const [assignment, setAssignment] = React.useState<AssignmentDetail | null>(null);
  const [title, setTitle] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [marksTotal, setMarksTotal] = React.useState("");
  const [criterionTitle, setCriterionTitle] = React.useState("");
  const [criterionMaxMarks, setCriterionMaxMarks] = React.useState("10");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .getAssignment(id)
      .then((a) => {
        setAssignment(a);
        setTitle(a.title);
        setBrief(a.brief);
        setMarksTotal(String(a.marksTotal));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function saveDetails(): Promise<void> {
    setError(null);
    try {
      await api.updateAssignment(id, { title, brief, marksTotal: Number(marksTotal) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes");
    }
  }

  async function changeStatus(status: ContentStatus): Promise<void> {
    setError(null);
    try {
      await api.setAssignmentStatus(id, status);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status change failed");
    }
  }

  async function addCriterion(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await api.addCriterion(id, { title: criterionTitle, maxMarks: Number(criterionMaxMarks) });
      setCriterionTitle("");
      setCriterionMaxMarks("10");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add criterion");
    }
  }

  async function removeCriterion(criterionId: string): Promise<void> {
    setError(null);
    try {
      await api.removeCriterion(id, criterionId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove criterion");
    }
  }

  async function remove(): Promise<void> {
    setError(null);
    try {
      await api.deleteAssignment(id);
      router.push("/assignments");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete assignment");
    }
  }

  if (!assignment) {
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
        <Link href="/assignments" className="hover:underline">
          Assignments
        </Link>{" "}
        · <span className="text-neutral-800">{assignment.title}</span>
      </nav>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-heading">{assignment.title}</h1>
          <StatusBadge status={assignment.status} />
        </div>
        <div className="flex gap-2">
          <StatusActions status={assignment.status} onChange={(s) => void changeStatus(s)} />
          <Link href={`/assignments/submissions?assignmentId=${assignment.id}`}>
            <Button variant="secondary">Submissions</Button>
          </Link>
        </div>
      </div>
      <FieldError>{error}</FieldError>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void saveDetails();
        }}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
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
        <Button type="submit">Save</Button>
      </form>
      <div className="mt-3">
        <Label htmlFor="brief">Brief</Label>
        <textarea
          id="brief"
          className="mt-1.5 min-h-24 w-full rounded-md border border-neutral-300 p-3 text-sm"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          onBlur={() => void saveDetails()}
        />
      </div>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Rubric criteria</h2>
        <form onSubmit={addCriterion} className="mt-3 flex flex-wrap items-end gap-3">
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
          <Button type="submit" disabled={!criterionTitle}>
            Add criterion
          </Button>
        </form>

        {assignment.criteria.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-100">
            {assignment.criteria.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {c.title} <span className="text-neutral-400">({c.maxMarks} marks)</span>
                </span>
                <Button variant="ghost" onClick={() => void removeCriterion(c.id)}>
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
      </section>

      <div className="mt-6">
        <Button variant="ghost" onClick={() => void remove()}>
          Delete assignment
        </Button>
      </div>
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
