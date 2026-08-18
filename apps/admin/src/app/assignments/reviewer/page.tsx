"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import type { AssignmentSubmissionStatus, ReviewerQueueItem } from "@examora/types";
import { ASSIGNMENT_SUBMISSION_STATUSES } from "@examora/types";
import { Button } from "@examora/ui";
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

function ReviewerQueueContent() {
  const api = useAssignmentAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [items, setItems] = React.useState<ReviewerQueueItem[]>([]);
  const [filter, setFilter] = React.useState<AssignmentSubmissionStatus | "ALL">("ALL");

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .reviewerQueue(filter === "ALL" ? undefined : filter)
      .then((res) => {
        setItems(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Reviewer queue"
        subtitle="Submissions assigned to you for review."
        actions={
          <Link href="/assignments">
            <Button variant="secondary">Assignments</Button>
          </Link>
        }
      />

      <Card density="compact">
        <div className="max-w-xs">
          <SelectField
            id="reviewer-status-filter"
            label="Status"
            value={filter}
            options={STATUS_FILTERS.map((s) => ({
              value: s,
              label: s === "ALL" ? "All statuses" : statusLabel(s),
            }))}
            onChange={(v) => setFilter(v as AssignmentSubmissionStatus | "ALL")}
          />
        </div>
      </Card>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load your reviewer queue" onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            heading="Nothing assigned to you right now"
            body="Try a different status filter."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Assignment
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Student
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Version
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Submitted
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-neutral-700">{item.assignmentTitle}</td>
                    <td className="px-4 py-3 text-neutral-600">{item.studentEmail}</td>
                    <td className="px-4 py-3 text-neutral-600">{item.version}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Chip tone={STATUS_TONE[item.status]}>{statusLabel(item.status)}</Chip>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                      {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/assignments/reviewer/${item.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        Review
                      </Link>
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

export default function ReviewerQueuePage() {
  return (
    <RequirePermission permission="assignment:review">
      <ReviewerQueueContent />
    </RequirePermission>
  );
}
