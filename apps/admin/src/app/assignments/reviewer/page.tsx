"use client";

import * as React from "react";
import Link from "next/link";
import type { AssignmentSubmissionStatus, ReviewerQueueItem } from "@examora/types";
import { ASSIGNMENT_SUBMISSION_STATUSES } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { useAssignmentAdminApi } from "@/lib/assignment-api";

const STATUS_FILTERS: (AssignmentSubmissionStatus | "ALL")[] = [
  "ALL",
  ...ASSIGNMENT_SUBMISSION_STATUSES,
];

function ReviewerQueueContent() {
  const api = useAssignmentAdminApi();
  const [items, setItems] = React.useState<ReviewerQueueItem[]>([]);
  const [status, setStatus] = React.useState<AssignmentSubmissionStatus | "ALL">("ALL");

  React.useEffect(() => {
    api
      .reviewerQueue(status === "ALL" ? undefined : status)
      .then((res) => setItems(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Reviewer queue</h1>
        <Link href="/assignments" className="text-sm text-primary-600 hover:underline">
          Assignments →
        </Link>
      </div>
      <p className="mt-1 text-sm text-neutral-600">Submissions assigned to you for review.</p>

      <div className="mt-6 flex gap-2">
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

      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Assignment</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Version</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">{item.assignmentTitle}</td>
                <td className="px-4 py-3">{item.studentEmail}</td>
                <td className="px-4 py-3">{item.version}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/assignments/reviewer/${item.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  Nothing assigned to you right now.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function ReviewerQueuePage() {
  return (
    <RequirePermission permission="assignment:review">
      <ReviewerQueueContent />
    </RequirePermission>
  );
}
