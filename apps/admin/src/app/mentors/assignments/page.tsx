"use client";

import * as React from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { useAuth, ApiError } from "@examora/auth-client";
import type { MentorAssignment, PaginatedData, UserProfile } from "@examora/types";
import { Button, FieldError } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { useMentorApi } from "@/lib/mentor-api";

function MentorAssignmentsContent() {
  const api = useMentorApi();
  const { request } = useAuth();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [assignments, setAssignments] = React.useState<MentorAssignment[]>([]);
  const [students, setStudents] = React.useState<UserProfile[]>([]);
  const [mentors, setMentors] = React.useState<UserProfile[]>([]);
  const [studentId, setStudentId] = React.useState("");
  const [mentorId, setMentorId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pendingUnassign, setPendingUnassign] = React.useState<MentorAssignment | null>(null);
  const [unassigning, setUnassigning] = React.useState(false);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listAssignments()
      .then((res) => {
        setAssignments(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
    request<PaginatedData<UserProfile>>("/admin/users?role=STUDENT&pageSize=100", { method: "GET" })
      .then((res) => setStudents(res.items))
      .catch(() => undefined);
    request<PaginatedData<UserProfile>>("/admin/users?role=MENTOR&pageSize=100", { method: "GET" })
      .then((res) => setMentors(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function assign(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!studentId || !mentorId) {
      setError("Choose both a student and a mentor");
      return;
    }
    try {
      await api.assignMentor(studentId, mentorId);
      setStudentId("");
      setMentorId("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign mentor");
    }
  }

  async function confirmUnassign(): Promise<void> {
    if (!pendingUnassign) return;
    setError(null);
    setUnassigning(true);
    try {
      await api.unassignMentor(pendingUnassign.studentId);
      setPendingUnassign(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not unassign mentor");
    } finally {
      setUnassigning(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Mentor assignments"
        subtitle="Assigning a student who already has an active mentor reassigns them — the previous assignment is kept as history, never deleted."
        actions={
          <Link href="/mentors">
            <Button variant="secondary">Mentors</Button>
          </Link>
        }
      />

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">New assignment</h2>
        <form onSubmit={assign} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-64">
            <SelectField
              id="student"
              label="Student"
              value={studentId}
              options={[
                { value: "", label: "— choose —" },
                ...students.map((s) => ({ value: s.id, label: s.email })),
              ]}
              onChange={setStudentId}
            />
          </div>
          <div className="w-64">
            <SelectField
              id="mentor"
              label="Mentor"
              value={mentorId}
              options={[
                { value: "", label: "— choose —" },
                ...mentors.map((m) => ({ value: m.id, label: m.email })),
              ]}
              onChange={setMentorId}
            />
          </div>
          <Button type="submit">Assign</Button>
        </form>
        <FieldError>{error}</FieldError>
      </Card>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load mentor assignments" onRetry={load} />
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            heading="No assignments yet"
            body="Assign a mentor to a student above."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Student
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Mentor
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Assigned
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/students/${a.studentId}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {a.studentEmail}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{a.mentorEmail}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                      {new Date(a.assignedAt).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Chip tone={a.unassignedAt ? "neutral" : "success"}>
                        {a.unassignedAt ? "Ended" : "Active"}
                      </Chip>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!a.unassignedAt ? (
                        <Button variant="ghost" onClick={() => setPendingUnassign(a)}>
                          Unassign
                        </Button>
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
        open={pendingUnassign !== null}
        title="Unassign this mentor?"
        message={
          pendingUnassign ? (
            <>
              Unassign{" "}
              <span className="font-medium text-neutral-800">{pendingUnassign.mentorEmail}</span>{" "}
              from{" "}
              <span className="font-medium text-neutral-800">{pendingUnassign.studentEmail}</span>?
              This ends the assignment; it remains in history.
            </>
          ) : null
        }
        confirmLabel="Unassign"
        tone="danger"
        submitting={unassigning}
        error={error}
        onConfirm={() => void confirmUnassign()}
        onCancel={() => setPendingUnassign(null)}
      />
    </main>
  );
}

export default function MentorAssignmentsPage() {
  return (
    <RequirePermission permission="mentor:manage">
      <MentorAssignmentsContent />
    </RequirePermission>
  );
}
