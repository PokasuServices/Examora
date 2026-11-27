"use client";

import * as React from "react";
import { Mail } from "lucide-react";
import type { CollegeEnquiryView } from "@examora/types";
import { Button } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { useStudentAdminApi } from "@/lib/student-admin-api";

function EnquiriesContent() {
  const api = useStudentAdminApi();
  const [rows, setRows] = React.useState<CollegeEnquiryView[] | null>(null);
  const [error, setError] = React.useState(false);
  const load = React.useCallback(() => {
    setError(false);
    api
      .enquiries()
      .then(setRows)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => load(), [load]);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="College enquiries"
        subtitle="Students who asked a college to contact them."
      />
      <Card density="compact" className="p-0">
        {error ? (
          <RetryInline message="Couldn't load enquiries" onRetry={load} />
        ) : rows === null ? (
          <p className="p-4 text-sm text-neutral-500">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={Mail} heading="No enquiries yet" />
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rows.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">
                    {e.studentName} → {e.collegeName}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {e.studentEmail} · {new Date(e.createdAt).toLocaleString()}
                  </p>
                  {e.message ? (
                    <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                      &ldquo;{e.message}&rdquo;
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone={e.status === "NEW" ? "warning" : "success"}>
                    {e.status === "NEW" ? "New" : "Contacted"}
                  </Chip>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await api.setEnquiryStatus(e.id, e.status === "NEW" ? "CONTACTED" : "NEW");
                      load();
                    }}
                  >
                    {e.status === "NEW" ? "Mark contacted" : "Mark new"}
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

export default function EnquiriesPage() {
  return (
    <RequirePermission permission="colleges:manage">
      <EnquiriesContent />
    </RequirePermission>
  );
}
