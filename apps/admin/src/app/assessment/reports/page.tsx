"use client";

import * as React from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import type { QuestionReportView } from "@examora/types";
import { Button } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { useStudentAdminApi } from "@/lib/student-admin-api";

function ReportsContent() {
  const api = useStudentAdminApi();
  const [status, setStatus] = React.useState<"OPEN" | "RESOLVED" | "ALL">("OPEN");
  const [rows, setRows] = React.useState<QuestionReportView[] | null>(null);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(() => {
    setError(false);
    api
      .reports(status === "ALL" ? undefined : status)
      .then(setRows)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  React.useEffect(() => load(), [load]);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Question reports"
        subtitle="Problems students reported with questions (wrong key, typos, unclear figures)."
      />
      <Card density="compact">
        <div className="max-w-xs">
          <SelectField
            id="report-status"
            label="Status"
            value={status}
            options={[
              { value: "OPEN", label: "Open" },
              { value: "RESOLVED", label: "Resolved" },
              { value: "ALL", label: "All" },
            ]}
            onChange={(v) => setStatus(v as typeof status)}
          />
        </div>
      </Card>
      <Card density="compact" className="p-0">
        {error ? (
          <RetryInline message="Couldn't load reports" onRetry={load} />
        ) : rows === null ? (
          <p className="p-4 text-sm text-neutral-500">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={Flag} heading="No reports" body="Nothing to review right now." />
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/assessment/questions/${r.questionId}`}
                    className="line-clamp-2 text-sm font-medium text-primary-600 hover:underline"
                  >
                    {r.questionText}
                  </Link>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                    &ldquo;{r.message}&rdquo;
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {r.reporterEmail} · {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone={r.status === "OPEN" ? "warning" : "success"}>
                    {r.status === "OPEN" ? "Open" : "Resolved"}
                  </Chip>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await api.setReportStatus(r.id, r.status === "OPEN" ? "RESOLVED" : "OPEN");
                      load();
                    }}
                  >
                    {r.status === "OPEN" ? "Mark resolved" : "Reopen"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}

export default function QuestionReportsPage() {
  return (
    <RequirePermission permission="question:manage">
      <ReportsContent />
    </RequirePermission>
  );
}
