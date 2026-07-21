"use client";

import * as React from "react";
import Link from "next/link";
import { ApiError } from "@examora/auth-client";
import type { Assignment, AssignmentTemplate, ContentStatus } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { StatusBadge } from "@/components/status-badge";
import { useAssignmentAdminApi } from "@/lib/assignment-api";

const STATUS_FILTERS: (ContentStatus | "ALL")[] = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"];

function AssignmentsContent() {
  const api = useAssignmentAdminApi();
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [templates, setTemplates] = React.useState<AssignmentTemplate[]>([]);
  const [filter, setFilter] = React.useState<ContentStatus | "ALL">("ALL");
  const [title, setTitle] = React.useState("");
  const [templateId, setTemplateId] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [marksTotal, setMarksTotal] = React.useState("100");
  const [deadline, setDeadline] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .listAssignments(filter === "ALL" ? undefined : { status: filter })
      .then((res) => setAssignments(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    api
      .listTemplates()
      .then((res) => setTemplates(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await api.createAssignment({
        title,
        templateId: templateId || undefined,
        brief: templateId ? undefined : brief,
        marksTotal: templateId ? undefined : Number(marksTotal),
        fileRules: templateId
          ? undefined
          : {
              allowedMimeTypes: ["image/png", "image/jpeg", "application/pdf"],
              maxFileSizeMb: 20,
              maxFiles: 5,
            },
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
      });
      setTitle("");
      setTemplateId("");
      setBrief("");
      setDeadline("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create assignment");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Assignments</h1>
        <div className="flex gap-2">
          <Link href="/assignments/templates">
            <Button variant="secondary">Templates</Button>
          </Link>
          <Link href="/assignments/submissions">
            <Button variant="secondary">Submissions</Button>
          </Link>
          <Link href="/assignments/reviewer">
            <Button variant="secondary">Reviewer queue</Button>
          </Link>
        </div>
      </div>

      <form
        onSubmit={create}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template">From template</Label>
          <select
            id="template"
            className="h-10 w-56 rounded-md border border-neutral-300 px-3 text-sm"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">— create from scratch —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        {!templateId ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brief">Brief</Label>
              <Input
                id="brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
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
          </>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deadline">Deadline</Label>
          <Input
            id="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
        <Button type="submit">Create assignment</Button>
      </form>
      <FieldError>{error}</FieldError>

      <div className="mt-6 flex gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-md px-3 py-1 text-sm ${
              filter === s ? "bg-primary-600 text-white" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Marks</th>
              <th className="px-4 py-3 font-medium">Deadline</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/assignments/${a.id}`} className="text-primary-600 hover:underline">
                    {a.title}
                  </Link>
                </td>
                <td className="px-4 py-3">{a.marksTotal}</td>
                <td className="px-4 py-3">
                  {a.deadline ? new Date(a.deadline).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={a.status} />
                </td>
              </tr>
            ))}
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                  No assignments.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function AssignmentsPage() {
  return (
    <RequirePermission permission="assignment:manage">
      <AssignmentsContent />
    </RequirePermission>
  );
}
