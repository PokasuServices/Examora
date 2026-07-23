"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { Enrollment, EnrollmentStatus } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { CommerceNav } from "@/components/commerce-nav";
import { RequirePermission } from "@/components/require-permission";
import { useCommerceAdminApi } from "@/lib/commerce-api";

const STATUS_FILTERS: (EnrollmentStatus | "ALL")[] = ["ALL", "ACTIVE", "EXPIRED", "REVOKED"];

function EnrollmentsContent() {
  const api = useCommerceAdminApi();
  const [enrollments, setEnrollments] = React.useState<Enrollment[]>([]);
  const [filter, setFilter] = React.useState<EnrollmentStatus | "ALL">("ALL");
  const [userId, setUserId] = React.useState("");
  const [courseId, setCourseId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .listEnrollments(filter === "ALL" ? undefined : { status: filter })
      .then((res) => setEnrollments(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function grant(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await api.grantEnrollment(userId, courseId);
      setUserId("");
      setCourseId("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not grant enrollment");
    }
  }

  async function revoke(id: string): Promise<void> {
    setError(null);
    try {
      await api.revokeEnrollment(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke enrollment");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <CommerceNav />
      <h1 className="text-heading">Enrollments</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Manually grant course access (comps, offline payments, corrections) or revoke it — see
        ADR-0018. User and course ids can be found on the Users and Content pages.
      </p>

      <form
        onSubmit={grant}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="userId">User id</Label>
          <Input
            id="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
            className="w-72"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="courseId">Course id</Label>
          <Input
            id="courseId"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            required
            className="w-72"
          />
        </div>
        <Button type="submit">Grant access</Button>
      </form>
      <FieldError>{error}</FieldError>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-md px-3 py-1 text-sm ${
              filter === s ? "bg-primary-600 text-white" : "bg-neutral-100 text-neutral-700"
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
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Course</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Enrolled</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {enrollments.map((e) => (
              <tr key={e.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">{e.userEmail}</td>
                <td className="px-4 py-3">{e.courseTitle}</td>
                <td className="px-4 py-3">{e.source}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.status === "ACTIVE"
                        ? "bg-success-50 text-success-700"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {new Date(e.enrolledAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {e.status === "ACTIVE" ? (
                    <Button variant="ghost" onClick={() => void revoke(e.id)}>
                      Revoke
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  No enrollments.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
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
