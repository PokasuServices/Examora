"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Inbox } from "lucide-react";
import { useAuth } from "@examora/auth-client";
import type {
  AdminSubmissionSummary,
  Assignment,
  AssignmentSubmissionStatus,
  PaginatedData,
  UserProfile,
} from "@examora/types";
import { ASSIGNMENT_SUBMISSION_STATUSES } from "@examora/types";
import { Button, FieldError } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { useAssignmentAdminApi } from "@/lib/assignment-api";

const STATUS_FILTERS: (AssignmentSubmissionStatus | "ALL")[] = [
  "ALL",
  ...ASSIGNMENT_SUBMISSION_STATUSES,
];

const STATUS_TONE: Record<AssignmentSubmissionStatus, ChipTone> = {
  DRAFT: "neutral",
  SUBMITTED: "primary",
  UNDER_REVIEW: "warning",
  REVISION_REQUESTED: "danger",
  APPROVED: "success",
};

function SubmissionsContent() {
  const api = useAssignmentAdminApi();
  const { request } = useAuth();
  const assignmentIdParam = useSearchParams().get("assignmentId") ?? "";
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [submissions, setSubmissions] = React.useState<AdminSubmissionSummary[]>([]);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [reviewers, setReviewers] = React.useState<UserProfile[]>([]);
  const [assignmentId, setAssignmentId] = React.useState(assignmentIdParam);
  const [filter, setFilter] = React.useState<AssignmentSubmissionStatus | "ALL">("ALL");
  const [pendingReviewerId, setPendingReviewerId] = React.useState<Record<string, string>>({});
  const [reassignTarget, setReassignTarget] = React.useState<AdminSubmissionSummary | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listSubmissions({
        assignmentId: assignmentId || undefined,
        status: filter === "ALL" ? undefined : filter,
      })
      .then((res) => {
        setSubmissions(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    api
      .listAssignments()
      .then((res) => setAssignments(res.items))
      .catch(() => undefined);
    request<PaginatedData<UserProfile>>("/admin/users?pageSize=100", { method: "GET" })
      .then((res) =>
        setReviewers(
          res.items.filter((u) => u.roles.some((r) => r === "MENTOR" || r === "REVIEWER")),
        ),
      )
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmReassign(): Promise<void> {
    if (!reassignTarget) return;
    const reviewerId = pendingReviewerId[reassignTarget.id];
    if (!reviewerId) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.assignReviewer(reassignTarget.id, reviewerId);
      setReassignTarget(null);
      load();
    } catch {
      setError("Could not assign reviewer — must hold the MENTOR or REVIEWER role");
    } finally {
      setSubmitting(false);
    }
  }

  const reassignReviewerEmail = reassignTarget
    ? reviewers.find((r) => r.id === pendingReviewerId[reassignTarget.id])?.email
    : undefined;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Submission monitoring"
        subtitle="Track assignment submissions and assign or reassign reviewers."
        actions={
          <Link href="/assignments">
            <Button variant="secondary">Assignments</Button>
          </Link>
        }
      />

      <Card density="compact">
        <div className="flex flex-wrap gap-4">
          <div className="max-w-xs flex-1">
            <SelectField
              id="assignment-filter"
              label="Assignment"
              value={assignmentId}
              options={[
                { value: "", label: "All assignments" },
                ...assignments.map((a) => ({ value: a.id, label: a.title })),
              ]}
              onChange={setAssignmentId}
            />
          </div>
          <div className="max-w-xs flex-1">
            <SelectField
              id="submission-status-filter"
              label="Status"
              value={filter}
              options={STATUS_FILTERS.map((s) => ({
                value: s,
                label: s === "ALL" ? "All statuses" : statusLabel(s),
              }))}
              onChange={(v) => setFilter(v as AssignmentSubmissionStatus | "ALL")}
            />
          </div>
        </div>
      </Card>
      <FieldError>{error}</FieldError>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load submissions" onRetry={load} />
        ) : submissions.length === 0 ? (
          <EmptyState
            icon={Inbox}
            heading="No submissions found"
            body="Try a different assignment or status filter."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Assignment
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Student
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Reviewer
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Submitted
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Assign reviewer
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {submissions.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-neutral-700">{s.assignmentTitle}</td>
                    <td className="px-4 py-3 text-neutral-600">{s.studentEmail}</td>
                    <td className="px-4 py-3 text-neutral-600">{s.reviewerEmail ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Chip tone={STATUS_TONE[s.status]}>{statusLabel(s.status)}</Chip>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                      {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="w-52">
                          <SelectField
                            id={`reviewer-${s.id}`}
                            label="Reviewer"
                            value={pendingReviewerId[s.id] ?? ""}
                            options={[
                              { value: "", label: "— choose —" },
                              ...reviewers.map((r) => ({ value: r.id, label: r.email })),
                            ]}
                            onChange={(v) =>
                              setPendingReviewerId((prev) => ({ ...prev, [s.id]: v }))
                            }
                          />
                        </div>
                        <Button
                          variant="secondary"
                          disabled={!pendingReviewerId[s.id]}
                          onClick={() => setReassignTarget(s)}
                        >
                          {s.reviewerEmail ? "Reassign" : "Assign"}
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/assignments/submissions/${s.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={reassignTarget !== null}
        title={reassignTarget?.reviewerEmail ? "Reassign reviewer?" : "Assign reviewer?"}
        message={
          reassignTarget ? (
            <>
              Assign{" "}
              <span className="font-medium text-neutral-800">
                {reassignReviewerEmail ?? "the selected reviewer"}
              </span>{" "}
              to review{" "}
              <span className="font-medium text-neutral-800">{reassignTarget.studentEmail}</span>
              &rsquo;s submission for{" "}
              <span className="font-medium text-neutral-800">{reassignTarget.assignmentTitle}</span>
              ?
            </>
          ) : null
        }
        confirmLabel={reassignTarget?.reviewerEmail ? "Reassign" : "Assign"}
        submitting={submitting}
        error={error}
        onConfirm={() => void confirmReassign()}
        onCancel={() => setReassignTarget(null)}
      />
    </main>
  );
}

export default function SubmissionsPage() {
  return (
    <RequirePermission permission="assignment:manage">
      <React.Suspense fallback={null}>
        <SubmissionsContent />
      </React.Suspense>
    </RequirePermission>
  );
}
