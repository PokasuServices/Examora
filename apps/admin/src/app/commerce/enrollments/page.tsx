"use client";

import * as React from "react";
import { BookOpen } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { Enrollment, EnrollmentStatus } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { useCommerceAdminApi } from "@/lib/commerce-api";

const STATUS_FILTERS: (EnrollmentStatus | "ALL")[] = ["ALL", "ACTIVE", "EXPIRED", "REVOKED"];

function EnrollmentsContent() {
  const api = useCommerceAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [enrollments, setEnrollments] = React.useState<Enrollment[]>([]);
  const [filter, setFilter] = React.useState<EnrollmentStatus | "ALL">("ALL");
  const [formOpen, setFormOpen] = React.useState(false);
  const [userId, setUserId] = React.useState("");
  const [courseId, setCourseId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<Enrollment | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listEnrollments(filter === "ALL" ? undefined : { status: filter })
      .then((res) => {
        setEnrollments(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function grant(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.grantEnrollment(userId, courseId);
      setUserId("");
      setCourseId("");
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not grant enrollment");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmRevoke(): Promise<void> {
    if (!revokeTarget) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.revokeEnrollment(revokeTarget.id);
      setRevokeTarget(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke enrollment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Enrollments"
        subtitle="Manually grant course access (comps, offline payments, corrections) or revoke it. User and course ids can be found on the Users and Content pages."
        actions={
          !formOpen ? <Button onClick={() => setFormOpen(true)}>Grant access</Button> : undefined
        }
      />

      {formOpen ? (
        <form
          onSubmit={(e) => void grant(e)}
          className="flex flex-col gap-4 rounded-md border border-neutral-100 bg-neutral-50/50 p-4"
        >
          <h3 className="font-heading text-sm font-semibold text-neutral-900">Grant enrollment</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="userId">User id</Label>
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="courseId">Course id</Label>
              <Input
                id="courseId"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
              />
            </div>
          </div>
          <FieldError>{error}</FieldError>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting || !userId.trim() || !courseId.trim()}>
              {submitting ? "Granting…" : "Grant access"}
            </Button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-sm font-medium text-neutral-600 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <Card density="compact">
        <div className="max-w-xs">
          <SelectField
            id="enrollment-status-filter"
            label="Status"
            value={filter}
            options={STATUS_FILTERS.map((s) => ({
              value: s,
              label: s === "ALL" ? "All statuses" : statusLabel(s),
            }))}
            onChange={(v) => setFilter(v as EnrollmentStatus | "ALL")}
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
          <RetryInline message="Couldn't load enrollments" onRetry={load} />
        ) : enrollments.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            heading="No enrollments found"
            body="Try a different status filter."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Student
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Course
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Source
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Enrolled
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {enrollments.map((e) => (
                  <tr key={e.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-neutral-700">{e.userEmail}</td>
                    <td className="px-4 py-3 text-neutral-700">{e.courseTitle}</td>
                    <td className="px-4 py-3 text-neutral-600">{e.source}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Chip tone={e.status === "ACTIVE" ? "success" : "neutral"}>
                        {statusLabel(e.status)}
                      </Chip>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                      {new Date(e.enrolledAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.status === "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => setRevokeTarget(e)}
                          className="text-sm font-medium text-danger-600 hover:underline"
                        >
                          Revoke
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={revokeTarget !== null}
        title="Revoke enrollment?"
        message={
          revokeTarget ? (
            <>
              Revoke <span className="font-medium text-neutral-800">{revokeTarget.userEmail}</span>
              &rsquo;s access to{" "}
              <span className="font-medium text-neutral-800">{revokeTarget.courseTitle}</span>?
            </>
          ) : null
        }
        confirmLabel="Revoke"
        tone="danger"
        submitting={submitting}
        error={error}
        onConfirm={() => void confirmRevoke()}
        onCancel={() => setRevokeTarget(null)}
      />
    </main>
  );
}

export default function EnrollmentsPage() {
  return (
    <RequirePermission permission="commerce:manage">
      <EnrollmentsContent />
    </RequirePermission>
  );
}
