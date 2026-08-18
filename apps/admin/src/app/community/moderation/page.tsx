"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { CommunityReport, CommunityReportStatus } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
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
import { useCommunityAdminApi } from "@/lib/community-api";

const STATUS_FILTERS: CommunityReportStatus[] = ["PENDING", "REVIEWED", "DISMISSED"];

const STATUS_TONE: Record<CommunityReportStatus, ChipTone> = {
  PENDING: "warning",
  REVIEWED: "success",
  DISMISSED: "neutral",
};

type PendingAction =
  | { kind: "REVIEW"; report: CommunityReport; next: "REVIEWED" | "DISMISSED" }
  | { kind: "HIDE"; report: CommunityReport }
  | null;

function ModerationQueueContent() {
  const api = useCommunityAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [reportStatus, setReportStatus] = React.useState<CommunityReportStatus>("PENDING");
  const [reports, setReports] = React.useState<CommunityReport[]>([]);
  const [pending, setPending] = React.useState<PendingAction>(null);
  const [hideReason, setHideReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listReports(reportStatus)
      .then((res) => {
        setReports(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportStatus]);

  React.useEffect(() => {
    load();
  }, [load]);

  function openReview(report: CommunityReport, next: "REVIEWED" | "DISMISSED"): void {
    setError(null);
    setPending({ kind: "REVIEW", report, next });
  }

  function openHide(report: CommunityReport): void {
    setError(null);
    setHideReason(report.reason);
    setPending({ kind: "HIDE", report });
  }

  async function confirmAction(): Promise<void> {
    if (!pending) return;
    setError(null);
    if (pending.kind === "HIDE" && !hideReason.trim()) {
      setError("A reason is required to hide this thread.");
      return;
    }
    setSubmitting(true);
    try {
      if (pending.kind === "HIDE") {
        await api.hideThread(pending.report.targetId, hideReason.trim());
      } else {
        await api.reviewReport(pending.report.id, pending.next);
      }
      setPending(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete this action");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Moderation queue"
        subtitle="Reported threads and replies awaiting review."
        actions={
          <Link href="/community/forums">
            <Button variant="secondary">Manage forums</Button>
          </Link>
        }
      />

      <Card density="compact">
        <div className="max-w-xs">
          <SelectField
            id="report-status-filter"
            label="Status"
            value={reportStatus}
            options={STATUS_FILTERS.map((s) => ({ value: s, label: statusLabel(s) }))}
            onChange={(v) => setReportStatus(v as CommunityReportStatus)}
          />
        </div>
      </Card>
      <FieldError>{error}</FieldError>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load reports" onRetry={load} />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            heading="No reports found"
            body="Try a different status filter."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Target
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Preview
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Reason
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Reporter
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      {report.targetType === "THREAD" ? (
                        <Link
                          href={`/community/threads/${report.targetId}`}
                          className="font-medium text-primary-600 hover:underline"
                        >
                          Thread
                        </Link>
                      ) : (
                        <span className="text-neutral-700">Reply</span>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-neutral-600">
                      {report.targetPreview ?? "—"}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-neutral-600">
                      {report.reason}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{report.reporterEmail}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Chip tone={STATUS_TONE[report.status]}>{statusLabel(report.status)}</Chip>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {report.status === "PENDING" ? (
                        <div className="flex justify-end gap-2">
                          {report.targetType === "THREAD" ? (
                            <Button variant="ghost" onClick={() => openHide(report)}>
                              Hide
                            </Button>
                          ) : null}
                          <Button variant="ghost" onClick={() => openReview(report, "REVIEWED")}>
                            Mark reviewed
                          </Button>
                          <Button variant="ghost" onClick={() => openReview(report, "DISMISSED")}>
                            Dismiss
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-500">
                          {statusLabel(report.status)} by {report.reviewedByEmail ?? "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === "HIDE"
            ? "Hide this thread?"
            : pending?.kind === "REVIEW" && pending.next === "REVIEWED"
              ? "Mark this report reviewed?"
              : "Dismiss this report?"
        }
        message={
          pending?.kind === "HIDE" ? (
            <div className="flex flex-col gap-1.5 text-left">
              <p>The thread will be hidden from students. This action requires a reason.</p>
              <Label htmlFor="hide-reason">Reason</Label>
              <Input
                id="hide-reason"
                value={hideReason}
                onChange={(e) => setHideReason(e.target.value)}
              />
            </div>
          ) : pending?.kind === "REVIEW" && pending.next === "REVIEWED" ? (
            "This marks the report as reviewed with no further action taken."
          ) : (
            "This dismisses the report with no action taken."
          )
        }
        confirmLabel={
          pending?.kind === "HIDE"
            ? "Hide thread"
            : pending?.kind === "REVIEW" && pending.next === "REVIEWED"
              ? "Mark reviewed"
              : "Dismiss"
        }
        tone={pending?.kind === "HIDE" ? "danger" : "primary"}
        submitting={submitting}
        error={error}
        onConfirm={() => void confirmAction()}
        onCancel={() => setPending(null)}
      />
    </main>
  );
}

export default function ModerationQueuePage() {
  return (
    <RequirePermission permission="community:moderate">
      <ModerationQueueContent />
    </RequirePermission>
  );
}
