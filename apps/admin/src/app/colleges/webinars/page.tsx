"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { AdminCollege, AdminWebinar } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { MediaField } from "@/components/media-field";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { useStudentAdminApi, type WebinarInput } from "@/lib/student-admin-api";
import { DeleteGate } from "@/components/delete-gate";

/** ISO → value for <input type="datetime-local"> in the browser's local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function WebinarForm({
  initial,
  colleges,
  onSaved,
  onCancel,
}: {
  initial: AdminWebinar | null;
  colleges: AdminCollege[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const api = useStudentAdminApi();
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [collegeId, setCollegeId] = React.useState(initial?.collegeId ?? "");
  const [startsAt, setStartsAt] = React.useState(initial ? toLocalInput(initial.startsAt) : "");
  const [endsAt, setEndsAt] = React.useState(initial ? toLocalInput(initial.endsAt) : "");
  const [joinUrl, setJoinUrl] = React.useState(initial?.joinUrl ?? "");
  const [bannerUrl, setBannerUrl] = React.useState(initial?.bannerUrl ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [published, setPublished] = React.useState(initial?.published ?? true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!startsAt || !endsAt) {
      setError("Enter start and end times.");
      return;
    }
    const body: WebinarInput = {
      title,
      collegeId: collegeId || null,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      joinUrl: joinUrl || null,
      bannerUrl: bannerUrl || null,
      description: description || null,
      published,
    };
    setSaving(true);
    try {
      if (initial) await api.updateWebinar(initial.id, body);
      else await api.createWebinar(body);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{initial ? "Edit webinar" : "New webinar"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="w-title">Title</Label>
            <Input id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <SelectField
            id="w-college"
            label="College (optional)"
            value={collegeId}
            options={[
              { value: "", label: "— none —" },
              ...colleges.map((c) => ({ value: c.id, label: c.name })),
            ]}
            onChange={setCollegeId}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="w-join">Join link (shown to registered students)</Label>
            <Input
              id="w-join"
              placeholder="https://…"
              value={joinUrl}
              onChange={(e) => setJoinUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="w-start">Starts</Label>
            <Input
              id="w-start"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="w-end">Ends</Label>
            <Input
              id="w-end"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              required
            />
          </div>
        </div>
        <MediaField
          id="w-banner"
          label="Banner image (optional)"
          kind="image"
          value={bannerUrl}
          onChange={setBannerUrl}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-desc">Description (Markdown)</Label>
          <textarea
            id="w-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-24 rounded-md border border-neutral-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />{" "}
          Visible to students
        </label>
        <FieldError>{error}</FieldError>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save webinar"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function WebinarsContent() {
  const api = useStudentAdminApi();
  const [rows, setRows] = React.useState<AdminWebinar[] | null>(null);
  const [colleges, setColleges] = React.useState<AdminCollege[]>([]);
  const [error, setError] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminWebinar | "new" | null>(null);

  const load = React.useCallback(() => {
    setError(false);
    api
      .webinars()
      .then(setRows)
      .catch(() => setError(true));
    api
      .colleges()
      .then(setColleges)
      .catch(() => setColleges([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => load(), [load]);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Webinars"
        subtitle="Online sessions students can register for."
        actions={
          editing === null ? (
            <Button onClick={() => setEditing("new")}>Add webinar</Button>
          ) : undefined
        }
      />
      {editing !== null ? (
        <WebinarForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          colleges={colleges}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
      <Card density="compact" className="p-0">
        {error ? (
          <RetryInline message="Couldn't load webinars" onRetry={load} />
        ) : rows === null ? (
          <p className="p-4 text-sm text-neutral-500">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={CalendarDays} heading="No webinars yet" />
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rows.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">{w.title}</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(w.startsAt).toLocaleString()} · {w.collegeName ?? "No college"} ·{" "}
                    {w.registrations} registered
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {new Date(w.endsAt) < new Date() ? <Chip tone="neutral">Ended</Chip> : null}
                  {!w.published ? <Chip tone="neutral">Hidden</Chip> : null}
                  <Button size="sm" variant="outline" onClick={() => setEditing(w)}>
                    Edit
                  </Button>
                  <DeleteGate type={"webinar"} id={w.id}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (window.confirm(`Delete "${w.title}"?`)) {
                          await api.deleteWebinar(w.id).catch(() => undefined);
                          load();
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </DeleteGate>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}

export default function AdminWebinarsPage() {
  return (
    <RequirePermission permission="colleges:manage">
      <WebinarsContent />
    </RequirePermission>
  );
}
