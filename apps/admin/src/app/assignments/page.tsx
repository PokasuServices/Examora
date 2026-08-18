"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { Assignment, AssignmentTemplate, ContentStatus } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { useAssignmentAdminApi } from "@/lib/assignment-api";

const STATUS_FILTERS: (ContentStatus | "ALL")[] = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"];

const STATUS_TONE: Record<ContentStatus, ChipTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

function AssignmentsContent() {
  const api = useAssignmentAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [templates, setTemplates] = React.useState<AssignmentTemplate[]>([]);
  const [filter, setFilter] = React.useState<ContentStatus | "ALL">("ALL");
  const [title, setTitle] = React.useState("");
  const [templateId, setTemplateId] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [marksTotal, setMarksTotal] = React.useState("100");
  const [deadline, setDeadline] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listAssignments(filter === "ALL" ? undefined : { status: filter })
      .then((res) => {
        setAssignments(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
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
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Assignments"
        subtitle="Manage assignment briefs, rubrics, and publishing status."
        actions={
          <>
            <Link href="/assignments/templates">
              <Button variant="secondary">Templates</Button>
            </Link>
            <Link href="/assignments/submissions">
              <Button variant="secondary">Submissions</Button>
            </Link>
            <Link href="/assignments/reviewer">
              <Button variant="secondary">Reviewer queue</Button>
            </Link>
          </>
        }
      />

      <form
        onSubmit={(e) => void create(e)}
        className="flex flex-col gap-4 rounded-md border border-neutral-100 bg-neutral-50/50 p-4"
      >
        <h3 className="font-heading text-sm font-semibold text-neutral-900">New assignment</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <SelectField
            id="template"
            label="From template"
            value={templateId}
            options={[
              { value: "", label: "— create from scratch —" },
              ...templates.map((t) => ({ value: t.id, label: t.title })),
            ]}
            onChange={setTemplateId}
          />
          {!templateId ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brief">Brief</Label>
                <Input id="brief" value={brief} onChange={(e) => setBrief(e.target.value)} />
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
        </div>
        <FieldError>{error}</FieldError>
        <div>
          <Button type="submit" disabled={submitting || !title.trim()}>
            {submitting ? "Creating…" : "Create assignment"}
          </Button>
        </div>
      </form>

      <Card density="compact">
        <div className="max-w-xs">
          <SelectField
            id="assignment-status-filter"
            label="Status"
            value={filter}
            options={STATUS_FILTERS.map((s) => ({
              value: s,
              label: s === "ALL" ? "All statuses" : statusLabel(s),
            }))}
            onChange={(v) => setFilter(v as ContentStatus | "ALL")}
          />
        </div>
      </Card>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load assignments" onRetry={load} />
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            heading="No assignments found"
            body="Try a different status filter, or create one above."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Title
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Marks
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Deadline
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/assignments/${a.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{a.marksTotal}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                      {a.deadline ? new Date(a.deadline).toLocaleDateString() : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Chip tone={STATUS_TONE[a.status]}>{statusLabel(a.status)}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
