"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { MentorProfile } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { useMentorApi } from "@/lib/mentor-api";

function MentorDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useMentorApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [mentor, setMentor] = React.useState<MentorProfile | null>(null);
  const [bio, setBio] = React.useState("");
  const [specialization, setSpecialization] = React.useState("");
  const [maxStudents, setMaxStudents] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .getMentor(id)
      .then((m) => {
        setMentor(m);
        setBio(m.bio ?? "");
        setSpecialization(m.specialization ?? "");
        setMaxStudents(String(m.maxStudents));
        setStatus("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Failed to load");
        setStatus("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.updateMentor(id, { bio, specialization, maxStudents: Number(maxStudents) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  async function remove(): Promise<void> {
    setError(null);
    setDeleting(true);
    try {
      await api.deleteMentor(id);
      router.push("/mentors");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete mentor profile");
      setDeleting(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="flex flex-col gap-6">
        <Skeleton className="h-6 w-32" />
        <Card>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-4 h-24 w-full" />
        </Card>
      </main>
    );
  }

  if (status === "error" || !mentor) {
    return (
      <main>
        <Card>
          <RetryInline message="Couldn't load this mentor" onRetry={load} />
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <div>
        <Link
          href="/mentors"
          className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Mentors
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-800 dark:text-white/90">
          {mentor.email}
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Workload: {mentor.activeStudentCount} / {mentor.maxStudents} students
        </p>
      </div>

      <FieldError>{error}</FieldError>

      <Card>
        <h2 className="text-lg font-medium text-neutral-800 dark:text-white/90">Profile</h2>
        <form onSubmit={save} className="mt-4 flex flex-col gap-4">
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              className="min-h-24 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-sm text-neutral-900 dark:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-fit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-neutral-800 dark:text-white/90">Danger zone</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Permanently delete this mentor profile.
        </p>
        <Button
          variant="ghost"
          className="mt-4 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/15"
          onClick={() => setConfirmDelete(true)}
        >
          Delete mentor profile
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this mentor profile?"
        message="This removes the mentor profile permanently. This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        submitting={deleting}
        error={error}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
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
