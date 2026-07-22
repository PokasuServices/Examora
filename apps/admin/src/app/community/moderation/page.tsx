"use client";

import * as React from "react";
import Link from "next/link";
import type { CommunityReport, CommunityReportStatus } from "@examora/types";
import { Button } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { useCommunityAdminApi } from "@/lib/community-api";

function ModerationQueueContent() {
  const api = useCommunityAdminApi();
  const [status, setStatus] = React.useState<CommunityReportStatus>("PENDING");
  const [reports, setReports] = React.useState<CommunityReport[]>([]);

  const load = React.useCallback(() => {
    api
      .listReports(status)
      .then((res) => setReports(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function review(id: string, next: "REVIEWED" | "DISMISSED"): Promise<void> {
    await api.reviewReport(id, next);
    load();
  }

  async function hide(report: CommunityReport): Promise<void> {
    if (report.targetType !== "THREAD") return;
    const reason = window.prompt("Reason for hiding this thread?", report.reason);
    if (!reason) return;
    await api.hideThread(report.targetId, reason);
    window.alert("Thread hidden.");
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Moderation queue</h1>
        <Link href="/community/forums">
          <Button variant="secondary">Manage forums</Button>
        </Link>
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        Reported threads and replies awaiting review (community:moderate).
      </p>

      <div className="mt-4 flex gap-2 text-sm">
        {(["PENDING", "REVIEWED", "DISMISSED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 ${
              status === s ? "bg-primary-600 text-white" : "bg-neutral-100 text-neutral-600"
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
              <th className="px-4 py-3 font-medium">Target</th>
              <th className="px-4 py-3 font-medium">Preview</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Reporter</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  {report.targetType === "THREAD" ? (
                    <Link
                      href={`/community/threads/${report.targetId}`}
                      className="text-primary-600 hover:underline"
                    >
                      Thread
                    </Link>
                  ) : (
                    "Reply"
                  )}
                </td>
                <td className="max-w-xs truncate px-4 py-3">{report.targetPreview ?? "—"}</td>
                <td className="px-4 py-3">{report.reason}</td>
                <td className="px-4 py-3">{report.reporterEmail}</td>
                <td className="px-4 py-3 text-right">
                  {report.status === "PENDING" ? (
                    <div className="flex justify-end gap-2">
                      {report.targetType === "THREAD" ? (
                        <Button variant="ghost" onClick={() => void hide(report)}>
                          Hide
                        </Button>
                      ) : null}
                      <Button variant="ghost" onClick={() => void review(report.id, "REVIEWED")}>
                        Mark reviewed
                      </Button>
                      <Button variant="ghost" onClick={() => void review(report.id, "DISMISSED")}>
                        Dismiss
                      </Button>
                    </div>
                  ) : (
                    <span className="text-neutral-500">
                      {report.status} by {report.reviewedByEmail ?? "—"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {reports.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No {status.toLowerCase()} reports.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
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
