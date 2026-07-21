"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@examora/auth-client";
import type {
  AdminSubmissionSummary,
  Assignment,
  AssignmentSubmissionStatus,
  PaginatedData,
  UserProfile,
} from "@examora/types";
import { ASSIGNMENT_SUBMISSION_STATUSES } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { useAssignmentAdminApi } from "@/lib/assignment-api";

const STATUS_FILTERS: (AssignmentSubmissionStatus | "ALL")[] = [
  "ALL",
  ...ASSIGNMENT_SUBMISSION_STATUSES,
];

function SubmissionsContent() {
  const api = useAssignmentAdminApi();
  const { request } = useAuth();
  const assignmentIdParam = useSearchParams().get("assignmentId") ?? "";
  const [submissions, setSubmissions] = React.useState<AdminSubmissionSummary[]>([]);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [reviewers, setReviewers] = React.useState<UserProfile[]>([]);
  const [assignmentId, setAssignmentId] = React.useState(assignmentIdParam);
  const [status, setStatus] = React.useState<AssignmentSubmissionStatus | "ALL">("ALL");
  const [pendingReviewerId, setPendingReviewerId] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .listSubmissions({
        assignmentId: assignmentId || undefined,
        status: status === "ALL" ? undefined : status,
      })
      .then((res) => setSubmissions(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, status]);

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

  async function assignReviewer(submissionId: string): Promise<void> {
    const reviewerId = pendingReviewerId[submissionId];
    if (!reviewerId) return;
    setError(null);
    try {
      await api.assignReviewer(submissionId, reviewerId);
      load();
    } catch {
      setError("Could not assign reviewer — must hold the MENTOR or REVIEWER role");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Submission monitoring</h1>
        <Link href="/assignments" className="text-sm text-primary-600 hover:underline">
          Assignments →
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="assignmentFilter" className="text-sm font-medium text-neutral-800">
            Assignment
          </label>
          <select
            id="assignmentFilter"
            className="h-10 w-64 rounded-md border border-neutral-300 px-3 text-sm"
            value={assignmentId}
            onChange={(e) => setAssignmentId(e.target.value)}
          >
            <option value="">All assignments</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-md px-3 py-1 text-sm ${
              status === s ? "bg-primary-600 text-white" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-error-600">{error}</p> : null}

      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Assignment</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Reviewer</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium">Assign reviewer</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">{s.assignmentTitle}</td>
                <td className="px-4 py-3">{s.studentEmail}</td>
                <td className="px-4 py-3">{s.reviewerEmail ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <select
                      className="h-9 rounded-md border border-neutral-300 px-2 text-sm"
                      value={pendingReviewerId[s.id] ?? ""}
                      onChange={(e) =>
                        setPendingReviewerId((prev) => ({ ...prev, [s.id]: e.target.value }))
                      }
                    >
                      <option value="">— choose —</option>
                      {reviewers.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.email}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="text-sm text-primary-600 hover:underline disabled:text-neutral-300"
                      disabled={!pendingReviewerId[s.id]}
                      onClick={() => void assignReviewer(s.id)}
                    >
                      Assign
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/assignments/submissions/${s.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
                  No submissions.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
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
