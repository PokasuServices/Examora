"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Clock, MapPin, Plus, Trash2, Users, Video } from "lucide-react";
import { ApiError, useAuth } from "@examora/auth-client";
import type { BatchMode, BatchSlot, CohortView, Course, MentorProfile } from "@examora/types";
import { Button, FieldError, Input, Label, cn } from "@examora/ui";
import { DeleteGate } from "@/components/delete-gate";
import { ExcelBar } from "@/components/desk-ui";
import { useDeskApi } from "@/lib/desk-api";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { useContentApi } from "@/lib/content-api";
import { useMentorApi } from "@/lib/mentor-api";
import { useStudentAdminApi, type BatchInput } from "@/lib/student-admin-api";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MODES: { value: BatchMode; label: string }[] = [
  { value: "OFFLINE", label: "Offline (classroom)" },
  { value: "ONLINE", label: "Online" },
  { value: "HYBRID", label: "Hybrid" },
];
const MODE_CHIP: Record<BatchMode, string> = {
  OFFLINE: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  ONLINE: "bg-cyan-50 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200",
  HYBRID: "bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200",
};
const selectCls =
  "h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900";

/** "Mon, Wed 18:00–19:30" style summary of a timetable. */
function timetableText(slots: BatchSlot[]): string {
  if (slots.length === 0) return "No timetable yet";
  const byTime = new Map<string, number[]>();
  for (const s of slots) {
    const k = `${s.start}–${s.end}`;
    byTime.set(k, [...(byTime.get(k) ?? []), s.day]);
  }
  return [...byTime.entries()]
    .map(([t, days]) => `${days.map((d) => DAYS[d]).join(", ")} ${t}`)
    .join(" · ");
}

const DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Read-only batch details for mentors (the admin sets batches up). */
function BatchSummary({ cohort }: { cohort: CohortView }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Course", value: cohort.course?.title ?? "Not set" },
    { label: "Classes", value: MODES.find((m) => m.value === cohort.mode)?.label ?? cohort.mode },
    { label: "Timetable (IST)", value: timetableText(cohort.schedule) },
    {
      label: "Runs",
      value:
        cohort.startsOn || cohort.endsOn
          ? `${cohort.startsOn ? DATE.format(new Date(cohort.startsOn)) : "…"} – ${
              cohort.endsOn ? DATE.format(new Date(cohort.endsOn)) : "…"
            }`
          : "Dates not set",
    },
  ];
  if (cohort.location) rows.push({ label: "Classroom", value: cohort.location });
  if (cohort.meetingUrl) {
    rows.push({
      label: "Online class link",
      value: (
        <a
          href={cohort.meetingUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary-600 underline"
        >
          {cohort.meetingUrl}
        </a>
      ),
    });
  }
  rows.push({
    label: "Mentor",
    value: cohort.mentors.length ? cohort.mentors.map((m) => m.name).join(", ") : "Not assigned",
  });
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{cohort.name}</h2>
        {!cohort.isActive ? (
          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600 dark:bg-white/5">
            Inactive
          </span>
        ) : null}
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {r.label}
            </dt>
            <dd className="mt-0.5 break-words text-sm text-neutral-800 dark:text-neutral-200">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-neutral-500">
        The admin sets up batches. Ask them to change the timetable, dates or students.
      </p>
    </Card>
  );
}

/** A mentor can't add students; this sends the admin a request. */
function AskAdminToAdd({ cohortId }: { cohortId: string }) {
  const desk = useDeskApi();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", phone: "", note: "" });
  const [msg, setMsg] = React.useState<string | null>(null);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-sm font-medium text-primary-600 hover:underline"
      >
        + Ask the admin to add a student
      </button>
    );
  }
  return (
    <form
      className="mt-3 grid gap-2 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await desk.requestStudent({
            cohortId,
            name: form.name,
            email: form.email,
            phone: form.phone || undefined,
            note: form.note || undefined,
          });
          setMsg(`Sent. The admin will add ${form.name}.`);
          setForm({ name: "", email: "", phone: "", note: "" });
        } catch (err) {
          setMsg(err instanceof Error ? err.message : "Couldn't send");
        }
      }}
    >
      <Input
        aria-label="Student name"
        placeholder="Student name"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <Input
        aria-label="Email"
        type="email"
        placeholder="Email"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <Input
        aria-label="Phone"
        placeholder="Phone (optional)"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <Input
        aria-label="Note"
        placeholder="Note for the admin (optional)"
        value={form.note}
        onChange={(e) => setForm({ ...form, note: e.target.value })}
      />
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button size="sm" type="submit">
          Send to admin
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
        {msg ? (
          <span role="status" className="text-xs text-neutral-600">
            {msg}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Members({
  cohort,
  onChanged,
  readOnly = false,
}: {
  cohort: CohortView;
  onChanged: () => void;
  readOnly?: boolean;
}) {
  const api = useStudentAdminApi();
  const desk = useDeskApi();
  const [members, setMembers] = React.useState<
    { userId: string; email: string; name: string }[] | null
  >(null);
  const [emails, setEmails] = React.useState("");
  const [result, setResult] = React.useState<string | null>(null);
  const load = React.useCallback(() => {
    api
      .cohortMembers(cohort.id)
      .then(setMembers)
      .catch(() => setMembers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohort.id]);
  React.useEffect(() => load(), [load]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Users size={16} aria-hidden="true" /> Students{" "}
          <span className="text-sm font-normal text-neutral-500">{cohort.memberCount}</span>
        </h3>
        <ExcelBar
          downloadLabel="Download list"
          onDownload={() =>
            desk.download(
              `/staff-requests/batches/${cohort.id}/members/export`,
              "batch-students.xlsx",
            )
          }
          onTemplate={() =>
            desk.download(
              "/staff-requests/batches/members/template",
              "batch-students-template.xlsx",
            )
          }
          uploadLabel={readOnly ? "Upload (sent to admin)" : "Upload"}
          onUpload={(b64, name, dry) => desk.importMembers(cohort.id, b64, name, dry)}
          onImported={() => {
            load();
            onChanged();
          }}
        />
      </div>
      {readOnly ? <AskAdminToAdd cohortId={cohort.id} /> : null}
      {readOnly ? null : (
        <>
          <p className="text-xs text-neutral-500">
            Give everyone in this batch a course licence from Commerce → Enrollments (choose
            &ldquo;Batch&rdquo;).
          </p>
          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor="cohort-emails">
              Add students by email (one per line or comma-separated)
            </Label>
            <textarea
              id="cohort-emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              className="min-h-20 rounded-md border border-neutral-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                disabled={!emails.trim()}
                onClick={async () => {
                  const r = await api.addCohortMembers(
                    cohort.id,
                    emails.split(/[\s,;]+/).filter(Boolean),
                  );
                  setResult(
                    `Added ${r.added}.${r.notFound.length ? ` Not found: ${r.notFound.join(", ")}` : ""}`,
                  );
                  setEmails("");
                  load();
                  onChanged();
                }}
              >
                Add
              </Button>
              {result ? (
                <span role="status" className="text-xs text-neutral-600">
                  {result}
                </span>
              ) : null}
            </div>
          </div>
        </>
      )}
      {members === null ? (
        <p className="mt-4 text-sm text-neutral-500">Loading students…</p>
      ) : members.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No students yet.</p>
      ) : (
        <ul className="mt-4 max-h-96 divide-y divide-neutral-200 overflow-y-auto rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {m.name} <span className="text-xs text-neutral-500">{m.email}</span>
              </span>
              {readOnly ? null : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await api.removeCohortMember(cohort.id, m.userId);
                    load();
                    onChanged();
                  }}
                >
                  Remove from batch
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MentorsCard({
  cohort,
  mentors,
  onSaved,
}: {
  cohort: CohortView;
  mentors: MentorProfile[] | null;
  onSaved: (c: CohortView) => void;
}) {
  const api = useStudentAdminApi();
  const primary = cohort.mentors.find((m) => m.role === "PRIMARY");
  const cover = cohort.mentors.find((m) => m.role === "COVER");
  const [mentorId, setMentorId] = React.useState(primary?.id ?? "");
  const [coverId, setCoverId] = React.useState(cover?.id ?? "");
  const [coverEndsOn, setCoverEndsOn] = React.useState(cover?.endsOn ?? "");
  const [state, setState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const changed =
    mentorId !== (primary?.id ?? "") ||
    coverId !== (cover?.id ?? "") ||
    (coverId && coverEndsOn !== (cover?.endsOn ?? ""));
  const nameOf = (m: MentorProfile) => `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || m.email;
  return (
    <Card>
      <h3 className="text-base font-semibold">Mentor</h3>
      <p className="text-xs text-neutral-500">
        One mentor per batch: they take its classes and attendance, mark its students&rsquo; work
        and answer their doubts. A cover mentor stands in until the date you pick, then loses access
        automatically.
      </p>
      {mentors === null ? (
        <p className="mt-3 text-sm text-neutral-500">Loading mentors…</p>
      ) : mentors.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          No mentor profiles yet (Mentoring → Mentors).
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`primary-${cohort.id}`}>Batch mentor</Label>
            <select
              id={`primary-${cohort.id}`}
              className={selectCls}
              value={mentorId}
              onChange={(e) => setMentorId(e.target.value)}
            >
              <option value="">No mentor yet</option>
              {mentors.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {nameOf(m)}
                  {m.specialization ? ` · ${m.specialization}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`cover-${cohort.id}`}>Cover mentor (optional)</Label>
            <div className="flex gap-2">
              <select
                id={`cover-${cohort.id}`}
                className={cn(selectCls, "min-w-0 flex-1")}
                value={coverId}
                onChange={(e) => setCoverId(e.target.value)}
              >
                <option value="">None</option>
                {mentors
                  .filter((m) => m.userId !== mentorId)
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {nameOf(m)}
                    </option>
                  ))}
              </select>
              {coverId ? (
                <Input
                  aria-label="Cover until"
                  type="date"
                  className="w-40"
                  value={coverEndsOn}
                  onChange={(e) => setCoverEndsOn(e.target.value)}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
      <div className="mt-3 flex items-center gap-3">
        <Button
          size="sm"
          disabled={!changed || state === "saving" || (!!coverId && !coverEndsOn)}
          onClick={async () => {
            setState("saving");
            setError(null);
            try {
              onSaved(
                await api.setCohortMentors(cohort.id, {
                  mentorId: mentorId || null,
                  coverId: coverId || null,
                  coverEndsOn: coverId ? coverEndsOn : null,
                }),
              );
              setState("saved");
            } catch (err) {
              setState("error");
              setError(err instanceof Error ? err.message : "Couldn't save");
            }
          }}
        >
          {state === "saving" ? "Saving…" : "Save"}
        </Button>
        <span aria-live="polite" className="text-xs">
          {state === "saved" ? <span className="text-emerald-600">Saved</span> : null}
          {state === "error" ? <span className="text-red-600">{error}</span> : null}
        </span>
      </div>
    </Card>
  );
}

function DetailsCard({
  cohort,
  courses,
  onSaved,
  onDeleted,
}: {
  cohort: CohortView;
  courses: Course[];
  onSaved: (c: CohortView) => void;
  onDeleted: () => void;
}) {
  const api = useStudentAdminApi();
  const [form, setForm] = React.useState<BatchInput & { name: string }>({
    name: cohort.name,
    batch: cohort.batch,
    courseId: cohort.course?.id ?? null,
    mode: cohort.mode,
    schedule: cohort.schedule,
    startsOn: cohort.startsOn,
    endsOn: cohort.endsOn,
    location: cohort.location,
    meetingUrl: cohort.meetingUrl,
    isActive: cohort.isActive,
  });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const slots = form.schedule ?? [];
  const setSlot = (i: number, patch: Partial<BatchSlot>) =>
    set(
      "schedule",
      slots.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      onSaved(
        await api.updateCohort(cohort.id, {
          ...form,
          batch: form.batch || null,
          location: form.mode === "ONLINE" ? null : form.location || null,
          meetingUrl: form.mode === "OFFLINE" ? null : form.meetingUrl || null,
          startsOn: form.startsOn || null,
          endsOn: form.endsOn || null,
        }),
      );
      setMsg({ ok: true, text: "Saved" });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Couldn't save" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{cohort.name}</h2>
          <DeleteGate type="batch" id={cohort.id}>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} aria-hidden="true" /> Delete batch
            </Button>
          </DeleteGate>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-name">Name</Label>
            <Input id="b-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-label">Short label</Label>
            <Input
              id="b-label"
              placeholder="Evening / Weekend"
              value={form.batch ?? ""}
              onChange={(e) => set("batch", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-course">Course</Label>
            <select
              id="b-course"
              className={selectCls}
              value={form.courseId ?? ""}
              onChange={(e) => set("courseId", e.target.value || null)}
            >
              <option value="">No course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-mode">Classes are</Label>
            <select
              id="b-mode"
              className={selectCls}
              value={form.mode}
              onChange={(e) => set("mode", e.target.value as BatchMode)}
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-start">Starts on</Label>
            <Input
              id="b-start"
              type="date"
              value={form.startsOn ?? ""}
              onChange={(e) => set("startsOn", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-end">Ends on</Label>
            <Input
              id="b-end"
              type="date"
              value={form.endsOn ?? ""}
              onChange={(e) => set("endsOn", e.target.value)}
            />
          </div>
          {form.mode !== "ONLINE" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-loc">Classroom / address</Label>
              <Input
                id="b-loc"
                placeholder="Room 2, Pune centre"
                value={form.location ?? ""}
                onChange={(e) => set("location", e.target.value)}
              />
            </div>
          ) : null}
          {form.mode !== "OFFLINE" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-url">Online class link</Label>
              <Input
                id="b-url"
                type="url"
                placeholder="https://meet.google.com/…"
                value={form.meetingUrl ?? ""}
                onChange={(e) => set("meetingUrl", e.target.value)}
              />
            </div>
          ) : null}
        </div>

        <fieldset className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <legend className="px-1 text-sm font-medium">Weekly timetable (India time)</legend>
          {slots.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No classes yet. Add the days and times this batch meets.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {slots.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Day"
                    className={cn(selectCls, "w-28")}
                    value={s.day}
                    onChange={(e) => setSlot(i, { day: Number(e.target.value) })}
                  >
                    {DAYS.map((d, n) => (
                      <option key={d} value={n}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <Input
                    aria-label="Starts at"
                    type="time"
                    className="w-32"
                    value={s.start}
                    onChange={(e) => setSlot(i, { start: e.target.value })}
                  />
                  <span className="text-sm text-neutral-500">to</span>
                  <Input
                    aria-label="Ends at"
                    type="time"
                    className="w-32"
                    value={s.end}
                    onChange={(e) => setSlot(i, { end: e.target.value })}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Remove this class"
                    onClick={() =>
                      set(
                        "schedule",
                        slots.filter((_, j) => j !== i),
                      )
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() =>
              set("schedule", [
                ...slots,
                {
                  day: 1,
                  start: slots.at(-1)?.start ?? "18:00",
                  end: slots.at(-1)?.end ?? "19:30",
                },
              ])
            }
          >
            <Plus size={14} aria-hidden="true" /> Add a class
          </Button>
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive ?? true}
            onChange={(e) => set("isActive", e.target.checked)}
          />
          Active (running now)
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving || form.name.trim().length < 2}>
            {saving ? "Saving…" : "Save batch"}
          </Button>
          {msg ? (
            <span
              role="status"
              className={cn("text-sm", msg.ok ? "text-emerald-600" : "text-red-600")}
            >
              {msg.text}
            </span>
          ) : null}
        </div>
      </form>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this batch?"
        message={`"${cohort.name}" and its student list will be removed. Students keep their accounts and licences.`}
        confirmLabel="Delete"
        tone="danger"
        submitting={deleting}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await api.deleteCohort(cohort.id);
            setConfirmDelete(false);
            onDeleted();
          } finally {
            setDeleting(false);
          }
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Card>
  );
}

function BatchesContent() {
  const api = useStudentAdminApi();
  const contentApi = useContentApi();
  const mentorApi = useMentorApi();
  const { user } = useAuth();
  // Mentors see their batches; only the admin creates and edits them.
  const canManage = user?.permissions.includes("batches:manage") ?? false;
  const [rows, setRows] = React.useState<CohortView[] | null>(null);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [mentors, setMentors] = React.useState<MentorProfile[] | null>(null);
  const [error, setError] = React.useState(false);
  const params = useSearchParams();
  const [selected, setSelected] = React.useState<string | null>(params.get("batch"));
  const [name, setName] = React.useState("");
  const [courseId, setCourseId] = React.useState("");
  const [mode, setMode] = React.useState<BatchMode>("OFFLINE");
  const [formError, setFormError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setError(false);
    api
      .cohorts()
      .then(setRows)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    load();
    if (!canManage) return;
    contentApi
      .listCourses()
      .then((r) => setCourses(r.items))
      .catch(() => undefined);
    mentorApi
      .listMentors()
      .then((r) => setMentors(r.items))
      .catch(() => setMentors([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, canManage]);
  const current = rows?.find((r) => r.id === selected) ?? null;
  const replace = (c: CohortView) =>
    setRows((all) => (all ?? []).map((x) => (x.id === c.id ? c : x)));

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={canManage ? "Batches" : "My batches"}
        subtitle={
          canManage
            ? "Groups of students who study a course together: timetable, mentors and members. Attendance is taken per batch."
            : "The batches you teach: timetable, class place or link, and students."
        }
      />
      {canManage ? (
        <Card>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setFormError(null);
              try {
                const created = await api.createCohort({
                  name: name.trim(),
                  courseId: courseId || null,
                  mode,
                });
                setName("");
                setRows((all) => [created, ...(all ?? [])]);
                setSelected(created.id);
              } catch (err) {
                setFormError(err instanceof ApiError ? err.message : "Couldn't create");
              }
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cohort-name">New batch</Label>
              <Input
                id="cohort-name"
                placeholder="2027 NID UCEED – Evening"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-72"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cohort-course">Course</Label>
              <select
                id="cohort-course"
                className={cn(selectCls, "w-56")}
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="">Choose later</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cohort-mode">Classes are</Label>
              <select
                id="cohort-mode"
                className={selectCls}
                value={mode}
                onChange={(e) => setMode(e.target.value as BatchMode)}
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={name.trim().length < 2}>
              Create batch
            </Button>
          </form>
          <FieldError>{formError}</FieldError>
        </Card>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card density="compact" className="self-start p-0">
          {error ? (
            <RetryInline message="Couldn't load batches" onRetry={load} />
          ) : rows === null ? (
            <p className="p-4 text-sm text-neutral-500">Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState icon={Users} heading="No batches yet" />
          ) : (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {rows.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c.id)}
                    aria-current={selected === c.id ? "true" : undefined}
                    className={cn(
                      "flex w-full flex-col gap-1 px-4 py-3 text-left text-sm hover:bg-neutral-50 dark:hover:bg-white/[0.03]",
                      selected === c.id && "bg-primary-50 dark:bg-primary-500/15",
                      !c.isActive && "opacity-60",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-neutral-500">
                        <Users size={12} aria-hidden="true" /> {c.memberCount}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                      <span
                        className={cn("rounded-full px-2 py-0.5 font-medium", MODE_CHIP[c.mode])}
                      >
                        {c.mode === "OFFLINE" ? (
                          <MapPin size={11} aria-hidden="true" className="mr-0.5 inline" />
                        ) : (
                          <Video size={11} aria-hidden="true" className="mr-0.5 inline" />
                        )}
                        {c.mode.toLowerCase()}
                      </span>
                      {c.course ? <span className="truncate">{c.course.title}</span> : null}
                      {!c.isActive ? <span>· inactive</span> : null}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <Clock size={11} aria-hidden="true" /> {timetableText(c.schedule)}
                    </span>
                    {c.mentors.length > 0 ? (
                      <span className="truncate text-xs text-neutral-500">
                        Mentors: {c.mentors.map((m) => m.name).join(", ")}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {current && !canManage ? (
          <div className="flex flex-col gap-6">
            <BatchSummary cohort={current} />
            <Members key={current.id} cohort={current} onChanged={load} readOnly />
          </div>
        ) : current ? (
          <div className="flex flex-col gap-6">
            <DetailsCard
              key={`d-${current.id}`}
              cohort={current}
              courses={courses}
              onSaved={replace}
              onDeleted={() => {
                setRows((all) => (all ?? []).filter((x) => x.id !== current.id));
                setSelected(null);
              }}
            />
            <MentorsCard
              key={`m-${current.id}`}
              cohort={current}
              mentors={mentors}
              onSaved={replace}
            />
            <Members key={current.id} cohort={current} onChanged={load} />
          </div>
        ) : (
          <Card className="flex items-center gap-3">
            <CalendarDays size={18} aria-hidden="true" className="text-neutral-400" />
            <p className="text-sm text-neutral-500">
              {canManage
                ? "Choose a batch to edit its timetable, mentors and students."
                : "Choose a batch to see its timetable and students."}
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}

export default function BatchesPage() {
  return (
    <RequirePermission permission="batches:read">
      <React.Suspense fallback={null}>
        <BatchesContent />
      </React.Suspense>
    </RequirePermission>
  );
}
