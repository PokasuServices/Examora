"use client";

import * as React from "react";
import type { SketchReportView } from "@examora/types";
import { Button } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { adminMediaUrl } from "@/lib/media-api";
import { useStudentAdminApi } from "@/lib/student-admin-api";

/** Sketches students reported as inappropriate, to check and resolve. */
function SketchReportsContent() {
  const api = useStudentAdminApi();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const [status, setStatus] = React.useState<"OPEN" | "RESOLVED">("OPEN");
  const [rows, setRows] = React.useState<SketchReportView[] | null>(null);

  const load = React.useCallback(() => {
    setRows(null);
    apiRef.current
      .sketchReports(status)
      .then(setRows)
      .catch(() => setRows([]));
  }, [status]);
  React.useEffect(() => load(), [load]);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Reported sketches"
        subtitle="Sketches that students flagged from the practice workspace."
      />
      <div role="group" aria-label="Status" className="flex gap-2">
        {(["OPEN", "RESOLVED"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? "primary" : "outline"}
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
          >
            {s === "OPEN" ? "Open" : "Resolved"}
          </Button>
        ))}
      </div>
      {rows === null ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState heading={status === "OPEN" ? "No open reports" : "No resolved reports"} />
        </Card>
      ) : (
        rows.map((r) => {
          const url = adminMediaUrl(r.imageRef);
          return (
            <Card key={r.id}>
              <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                {url ? (
                  // Plain <img>: media URLs redirect to short-lived storage URLs.
                  <img
                    src={url}
                    alt={`Sketch by ${r.ownerName}`}
                    className="w-full rounded border border-neutral-200 object-contain dark:border-neutral-800"
                  />
                ) : (
                  <div className="h-28 rounded bg-neutral-100 dark:bg-white/5" />
                )}
                <div className="flex flex-col gap-2 text-sm">
                  <p className="text-neutral-800 dark:text-white/90">
                    <span className="font-medium">{r.reporterName}</span> reported{" "}
                    <span className="font-medium">{r.ownerName}</span>&rsquo;s sketch
                  </p>
                  <blockquote className="rounded bg-neutral-50 px-3 py-2 italic text-neutral-700 dark:bg-white/[0.03] dark:text-neutral-300">
                    {r.reason}
                  </blockquote>
                  <p className="line-clamp-2 text-xs text-neutral-500">{r.questionText}</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await api
                          .setSketchReport(r.id, status === "OPEN" ? "RESOLVED" : "OPEN")
                          .catch(() => undefined);
                        load();
                      }}
                    >
                      {status === "OPEN" ? "Mark resolved" : "Reopen"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </main>
  );
}

export default function SketchReportsPage() {
  return (
    <RequirePermission permission="assignment:review">
      <SketchReportsContent />
    </RequirePermission>
  );
}
