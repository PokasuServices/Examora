"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@examora/auth-client";
import type { MentorProfile } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { useMentorApi } from "@/lib/mentor-api";

function MentorDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useMentorApi();
  const [mentor, setMentor] = React.useState<MentorProfile | null>(null);
  const [bio, setBio] = React.useState("");
  const [specialization, setSpecialization] = React.useState("");
  const [maxStudents, setMaxStudents] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .getMentor(id)
      .then((m) => {
        setMentor(m);
        setBio(m.bio ?? "");
        setSpecialization(m.specialization ?? "");
        setMaxStudents(String(m.maxStudents));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await api.updateMentor(id, { bio, specialization, maxStudents: Number(maxStudents) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes");
    }
  }

  async function remove(): Promise<void> {
    setError(null);
    try {
      await api.deleteMentor(id);
      router.push("/mentors");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete mentor profile");
    }
  }

  if (!mentor) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
        <FieldError>{error}</FieldError>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/mentors" className="hover:underline">
          Mentors
        </Link>{" "}
        · <span className="text-neutral-800">{mentor.email}</span>
      </nav>

      <h1 className="text-heading">{mentor.email}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Workload: {mentor.activeStudentCount} / {mentor.maxStudents} students
      </p>
      <FieldError>{error}</FieldError>

      <form
        onSubmit={save}
        className="mt-6 flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="specialization">Specialization</Label>
            <Input
              id="specialization"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="w-64"
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
              className="w-28"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <textarea
            id="bio"
            className="mt-1.5 min-h-24 w-full rounded-md border border-neutral-300 p-3 text-sm"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-fit">
          Save changes
        </Button>
      </form>

      <div className="mt-6">
        <Button variant="ghost" onClick={() => void remove()}>
          Delete mentor profile
        </Button>
      </div>
    </main>
  );
}

export default function MentorDetailPage() {
  return (
    <RequirePermission permission="mentor:manage">
      <MentorDetailContent />
    </RequirePermission>
  );
}
