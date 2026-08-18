"use client";

import * as React from "react";
import Link from "next/link";
import { UserCog } from "lucide-react";
import { useAuth, ApiError } from "@examora/auth-client";
import type { MentorProfile, PaginatedData, UserProfile } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { useMentorApi } from "@/lib/mentor-api";

function MentorsContent() {
  const api = useMentorApi();
  const { request } = useAuth();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [mentors, setMentors] = React.useState<MentorProfile[]>([]);
  const [candidateUsers, setCandidateUsers] = React.useState<UserProfile[]>([]);
  const [userId, setUserId] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [specialization, setSpecialization] = React.useState("");
  const [maxStudents, setMaxStudents] = React.useState("10");
  const [error, setError] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<MentorProfile | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listMentors()
      .then((res) => {
        setMentors(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
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

  async function confirmRemove(): Promise<void> {
    if (!pendingDelete) return;
    setError(null);
    setDeleting(true);
    try {
      await api.deleteMentor(pendingDelete.id);
      setPendingDelete(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete mentor profile");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Mentors"
        subtitle="A mentor profile extends an existing MENTOR-role user — assign the role first from Users."
        actions={
          <>
            <Link href="/mentors/dashboard">
              <Button variant="secondary">Workload dashboard</Button>
            </Link>
            <Link href="/mentors/assignments">
              <Button variant="secondary">Assignments</Button>
            </Link>
          </>
        }
      />

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">
          Create mentor profile
        </h2>
        <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-64">
            <SelectField
              id="userId"
              label="MENTOR-role user"
              value={userId}
              options={[
                { value: "", label: "— choose —" },
                ...candidateUsers.map((u) => ({ value: u.id, label: u.email })),
              ]}
              onChange={setUserId}
            />
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
      </Card>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load mentors" onRetry={load} />
        ) : mentors.length === 0 ? (
          <EmptyState
            icon={UserCog}
            heading="No mentor profiles yet"
            body="Create one using the form above."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Mentor
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Specialization
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Workload
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {mentors.map((m) => (
                  <tr key={m.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/mentors/${m.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {m.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{m.specialization ?? "—"}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {m.activeStudentCount} / {m.maxStudents}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" onClick={() => setPendingDelete(m)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this mentor profile?"
        message={
          <>
            Remove the mentor profile for{" "}
            <span className="font-medium text-neutral-800">{pendingDelete?.email}</span>? This
            can&rsquo;t be undone.
          </>
        }
        confirmLabel="Delete"
        tone="danger"
        submitting={deleting}
        error={error}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setPendingDelete(null)}
      />
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
