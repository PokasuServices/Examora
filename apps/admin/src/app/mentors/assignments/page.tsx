"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@examora/auth-client";
import { ApiError } from "@examora/auth-client";
import type { MentorAssignment, PaginatedData, UserProfile } from "@examora/types";
import { Button, FieldError } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { useMentorApi } from "@/lib/mentor-api";

function MentorAssignmentsContent() {
  const api = useMentorApi();
  const { request } = useAuth();
  const [assignments, setAssignments] = React.useState<MentorAssignment[]>([]);
  const [students, setStudents] = React.useState<UserProfile[]>([]);
  const [mentors, setMentors] = React.useState<UserProfile[]>([]);
  const [studentId, setStudentId] = React.useState("");
  const [mentorId, setMentorId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .listAssignments()
      .then((res) => setAssignments(res.items))
      .catch(() => undefined);
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

  async function unassign(id: string): Promise<void> {
    setError(null);
    try {
      await api.unassignMentor(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not unassign mentor");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Mentor assignments</h1>
        <Link href="/mentors" className="text-sm text-primary-600 hover:underline">
          Mentors →
        </Link>
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        Assigning a student who already has an active mentor reassigns them — the previous
        assignment is kept as history, never deleted.
      </p>

      <form
        onSubmit={assign}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="student" className="text-sm font-medium text-neutral-800">
            Student
          </label>
          <select
            id="student"
            className="h-10 w-64 rounded-md border border-neutral-300 px-3 text-sm"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">— choose —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.email}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="mentor" className="text-sm font-medium text-neutral-800">
            Mentor
          </label>
          <select
            id="mentor"
            className="h-10 w-64 rounded-md border border-neutral-300 px-3 text-sm"
            value={mentorId}
            onChange={(e) => setMentorId(e.target.value)}
          >
            <option value="">— choose —</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.email}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Assign</Button>
      </form>
      <FieldError>{error}</FieldError>

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Mentor</th>
              <th className="px-4 py-3 font-medium">Assigned</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/students/${a.studentId}`}
                    className="text-primary-600 hover:underline"
                  >
                    {a.studentEmail}
                  </Link>
                </td>
                <td className="px-4 py-3">{a.mentorEmail}</td>
                <td className="px-4 py-3">{new Date(a.assignedAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  {a.unassignedAt ? (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">Ended</span>
                  ) : (
                    <span className="rounded-full bg-success-500/10 px-2 py-0.5 text-xs text-success-600">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {!a.unassignedAt ? (
                    <Button variant="ghost" onClick={() => void unassign(a.studentId)}>
                      Unassign
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No assignments yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
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
