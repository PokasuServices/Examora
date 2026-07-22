"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@examora/auth-client";
import { ApiError } from "@examora/auth-client";
import type { MentorProfile, PaginatedData, UserProfile } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { useMentorApi } from "@/lib/mentor-api";

function MentorsContent() {
  const api = useMentorApi();
  const { request } = useAuth();
  const [mentors, setMentors] = React.useState<MentorProfile[]>([]);
  const [candidateUsers, setCandidateUsers] = React.useState<UserProfile[]>([]);
  const [userId, setUserId] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [specialization, setSpecialization] = React.useState("");
  const [maxStudents, setMaxStudents] = React.useState("10");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .listMentors()
      .then((res) => setMentors(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    request<PaginatedData<UserProfile>>("/admin/users?role=MENTOR&pageSize=100", { method: "GET" })
      .then((res) =>
        setCandidateUsers(res.items.filter((u) => !mentors.some((m) => m.userId === u.id))),
      )
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentors]);

  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!userId) {
      setError("Choose a MENTOR-role user");
      return;
    }
    try {
      await api.createMentor({
        userId,
        bio: bio || undefined,
        specialization: specialization || undefined,
        maxStudents: Number(maxStudents),
      });
      setUserId("");
      setBio("");
      setSpecialization("");
      setMaxStudents("10");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create mentor profile");
    }
  }

  async function remove(id: string): Promise<void> {
    setError(null);
    try {
      await api.deleteMentor(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete mentor profile");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Mentors</h1>
        <div className="flex gap-2">
          <Link href="/mentors/dashboard">
            <Button variant="secondary">Workload dashboard</Button>
          </Link>
          <Link href="/mentors/assignments">
            <Button variant="secondary">Assignments</Button>
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        A mentor profile extends an existing MENTOR-role user — assign the role first from{" "}
        <Link href="/users" className="text-primary-600 hover:underline">
          Users
        </Link>
        .
      </p>

      <form
        onSubmit={create}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="userId">MENTOR-role user</Label>
          <select
            id="userId"
            className="h-10 w-64 rounded-md border border-neutral-300 px-3 text-sm"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">— choose —</option>
            {candidateUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="specialization">Specialization</Label>
          <Input
            id="specialization"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            className="w-48"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maxStudents">Max students</Label>
          <Input
            id="maxStudents"
            type="number"
            min={1}
            max={200}
            value={maxStudents}
            onChange={(e) => setMaxStudents(e.target.value)}
            className="w-24"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Input id="bio" value={bio} onChange={(e) => setBio(e.target.value)} className="w-64" />
        </div>
        <Button type="submit">Create mentor profile</Button>
      </form>
      <FieldError>{error}</FieldError>

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Mentor</th>
              <th className="px-4 py-3 font-medium">Specialization</th>
              <th className="px-4 py-3 font-medium">Workload</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {mentors.map((m) => (
              <tr key={m.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/mentors/${m.id}`} className="text-primary-600 hover:underline">
                    {m.email}
                  </Link>
                </td>
                <td className="px-4 py-3">{m.specialization ?? "—"}</td>
                <td className="px-4 py-3">
                  {m.activeStudentCount} / {m.maxStudents}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" onClick={() => void remove(m.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {mentors.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                  No mentor profiles yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function MentorsPage() {
  return (
    <RequirePermission permission="mentor:manage">
      <MentorsContent />
    </RequirePermission>
  );
}
