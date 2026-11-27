"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarCheck,
  CalendarPlus,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  XCircle,
} from "lucide-react";
import {
  ATTENDANCE_LABEL,
  ATTENDANCE_STATUSES,
  type AttendanceGrid,
  type AttendanceOverviewRow,
  type AttendancePeriod,
  type AttendanceStatus,
  type ClassSessionView,
  type CohortView,
  type SessionRoster,
} from "@examora/types";
import { Button, Input, Label, cn } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import {
  ExcelBar,
  Meter,
  Modal,
  Pill,
  SectionTitle,
  ToneCard,
  addDaysIso,
  dayLabel,
  percentTone,
  todayIso,
  useToast,
} from "@/components/desk-ui";
import { useDeskApi } from "@/lib/desk-api";
import { useStudentAdminApi } from "@/lib/student-admin-api";

const STATUS_STYLE: Record<AttendanceStatus, { on: string; letter: string }> = {
  PRESENT: { on: "bg-emerald-600 text-white border-emerald-600", letter: "P" },
  LATE: { on: "bg-amber-500 text-white border-amber-500", letter: "L" },
  ABSENT: { on: "bg-rose-600 text-white border-rose-600", letter: "A" },
  EXCUSED: { on: "bg-sky-600 text-white border-sky-600", letter: "E" },
};
const CELL: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  LATE: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  ABSENT: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  EXCUSED: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
};
const selectCls =
  "h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

function monthOf(d: string) {
  return d.slice(0, 7);
}
function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
  return { from, to };
}
function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1 + n, 1)).toISOString().slice(0, 7);
}
const MONTH_FMT = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// ------------------------------------------------------------------ roster

function RosterPanel({ sessionId, onSaved }: { sessionId: string; onSaved: () => void }) {
  const api = useDeskApi();
  const { toast, toastError, node } = useToast();
  const [roster, setRoster] = React.useState<SessionRoster | null>(null);
  const [marks, setMarks] = React.useState<Record<string, AttendanceStatus | null>>({});
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [topic, setTopic] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setRoster(null);
    api
      .roster(sessionId)
      .then((r) => {
        setRoster(r);
        setMarks(Object.fromEntries(r.students.map((s) => [s.userId, s.status])));
        setNotes(Object.fromEntries(r.students.map((s) => [s.userId, s.note ?? ""])));
        setTopic(r.session.topic ?? "");
      })
      .catch((e) => toastError(e, "Couldn't load the class"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (!roster) return <Card className="text-sm text-neutral-500">Loading class…</Card>;
  const s = roster.session;
  const future = s.date > todayIso();
  const counts = ATTENDANCE_STATUSES.map(
    (st) => [st, Object.values(marks).filter((m) => m === st).length] as const,
  );
  const unmarked = roster.students.filter((x) => !marks[x.userId]).length;

  async function save() {
    setSaving(true);
    try {
      const r = await api.mark(sessionId, {
        topic: topic || null,
        records: roster!.students
          .filter((x) => marks[x.userId])
          .map((x) => ({
            userId: x.userId,
            status: marks[x.userId]!,
            note: notes[x.userId] || null,
          })),
      });
      setRoster(r);
      toast("Attendance saved");
      onSaved();
    } catch (e) {
      toastError(e, "Couldn't save attendance");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ToneCard tone={s.takenAt ? "emerald" : "cyan"} className="p-5">
      {node}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-neutral-900 dark:text-white">
            {s.cohortName}
          </h2>
          <p className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-300">
            <Clock size={13} aria-hidden="true" /> {dayLabel(s.date)} · {s.start}–{s.end} ·{" "}
            {s.mode === "ONLINE" ? "Online" : (roster.location ?? "Classroom")}
          </p>
          {s.takenAt ? (
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              Marked by {s.takenBy ?? "a mentor"}. You can still correct it.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {counts.map(([st, n]) => (
            <Pill
              key={st}
              tone={
                st === "PRESENT"
                  ? "emerald"
                  : st === "LATE"
                    ? "amber"
                    : st === "ABSENT"
                      ? "rose"
                      : "cyan"
              }
            >
              {ATTENDANCE_LABEL[st]} {n}
            </Pill>
          ))}
          {unmarked ? <Pill tone="slate">Not marked {unmarked}</Pill> : null}
        </div>
      </div>

      {future ? (
        <p className="mt-4 rounded-md bg-neutral-50 p-3 text-sm text-neutral-600 dark:bg-white/[0.03]">
          This class is on {dayLabel(s.date)}. You can mark attendance on the day.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex min-w-[14rem] flex-1 flex-col gap-1.5">
              <Label htmlFor="topic">What was taught (optional)</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Two-point perspective"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setMarks((m) =>
                  Object.fromEntries(Object.keys(m).map((k) => [k, m[k] ?? "PRESENT"])),
                )
              }
            >
              <CheckCheck size={14} aria-hidden="true" /> Everyone else present
            </Button>
          </div>
          <ul className="mt-4 divide-y divide-neutral-200/70 rounded-md border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
            {roster.students.map((st) => (
              <li key={st.userId} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <div className="min-w-[10rem] flex-1">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">{st.name}</p>
                  <p className="text-xs text-neutral-500">
                    {st.recentPercent === null
                      ? "No classes yet"
                      : `${st.recentPercent}% last 30 days`}
                  </p>
                </div>
                <div
                  role="radiogroup"
                  aria-label={`Attendance for ${st.name}`}
                  className="flex gap-1"
                >
                  {ATTENDANCE_STATUSES.map((status) => {
                    const on = marks[st.userId] === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        title={ATTENDANCE_LABEL[status]}
                        onClick={() => setMarks((m) => ({ ...m, [st.userId]: status }))}
                        className={cn(
                          "h-8 w-9 rounded-md border text-xs font-semibold transition",
                          on
                            ? STATUS_STYLE[status].on
                            : "border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-white/5",
                        )}
                      >
                        {STATUS_STYLE[status].letter}
                      </button>
                    );
                  })}
                </div>
                {marks[st.userId] === "EXCUSED" ||
                marks[st.userId] === "LATE" ||
                notes[st.userId] ? (
                  <Input
                    aria-label={`Note for ${st.name}`}
                    className="h-8 w-48 text-xs"
                    placeholder={marks[st.userId] === "EXCUSED" ? "Reason (e.g. unwell)" : "Note"}
                    value={notes[st.userId] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [st.userId]: e.target.value }))}
                  />
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-end gap-3">
            <p className="text-xs text-neutral-500">
              P present · L late · A absent · E excused (not counted)
            </p>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save attendance"}
            </Button>
          </div>
        </>
      )}
    </ToneCard>
  );
}

// ------------------------------------------------------------------ tabs

function MarkTab({
  batches,
  initialSession,
}: {
  batches: CohortView[];
  initialSession: string | null;
}) {
  const api = useDeskApi();
  const router = useRouter();
  const { toast, toastError, node } = useToast();
  const [cohortId, setCohortId] = React.useState("");
  const [weekStart, setWeekStart] = React.useState(() => addDaysIso(todayIso(), -6));
  const [sessions, setSessions] = React.useState<ClassSessionView[] | null>(null);
  const [selected, setSelected] = React.useState<string | null>(initialSession);
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .sessions(weekStart, addDaysIso(weekStart, 13), cohortId || undefined)
      .then((rows) => {
        setSessions(rows);
        if (!selected) {
          const pick =
            rows.find((r) => !r.takenAt && !r.cancelled && r.date <= todayIso()) ??
            rows.filter((r) => r.date <= todayIso()).at(-1);
          if (pick) setSelected(pick.id);
        }
      })
      .catch(() => setSessions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, cohortId]);
  React.useEffect(() => load(), [load]);

  const byDay = new Map<string, ClassSessionView[]>();
  for (const s of sessions ?? []) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      {node}
      <Card density="compact" className="self-start">
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Earlier"
            onClick={() => setWeekStart((w) => addDaysIso(w, -7))}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
            {dayLabel(weekStart)} – {dayLabel(addDaysIso(weekStart, 13))}
          </p>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Later"
            onClick={() => setWeekStart((w) => addDaysIso(w, 7))}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
        <select
          aria-label="Batch"
          className={cn(selectCls, "mt-2 w-full")}
          value={cohortId}
          onChange={(e) => setCohortId(e.target.value)}
        >
          <option value="">All my batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {sessions === null ? (
          <p className="mt-3 text-sm text-neutral-500">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No classes in these two weeks.</p>
        ) : (
          <ul className="mt-3 flex max-h-[32rem] flex-col gap-3 overflow-y-auto pr-1">
            {[...byDay.entries()].map(([day, list]) => (
              <li key={day}>
                <p
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    day === todayIso() ? "text-primary-600" : "text-neutral-400",
                  )}
                >
                  {day === todayIso() ? "Today" : dayLabel(day)}
                </p>
                <ul className="mt-1 flex flex-col gap-1">
                  {list.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(s.id);
                          router.replace(`/attendance?session=${s.id}`);
                        }}
                        aria-current={selected === s.id ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-50 dark:hover:bg-white/[0.03]",
                          selected === s.id && "bg-primary-50 dark:bg-primary-500/15",
                          s.cancelled && "opacity-50 line-through",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{s.cohortName}</span>
                          <span className="text-xs text-neutral-500">
                            {s.start}–{s.end}
                          </span>
                        </span>
                        {s.cancelled ? (
                          <Pill tone="slate">Cancelled</Pill>
                        ) : s.takenAt ? (
                          <Pill tone="emerald">
                            {s.counts.PRESENT + s.counts.LATE}/{s.total}
                          </Pill>
                        ) : s.date <= todayIso() ? (
                          <Pill tone="amber">To mark</Pill>
                        ) : (
                          <Pill tone="slate">Upcoming</Pill>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <CalendarPlus size={14} aria-hidden="true" /> Extra class
          </Button>
          {selected ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                const s = sessions?.find((x) => x.id === selected);
                if (!s) return;
                try {
                  await api.updateSession(s.id, { cancelled: !s.cancelled });
                  toast(s.cancelled ? "Class restored" : "Class cancelled (not counted)");
                  load();
                } catch (e) {
                  toastError(e);
                }
              }}
            >
              <XCircle size={14} aria-hidden="true" />
              {sessions?.find((x) => x.id === selected)?.cancelled
                ? "Restore class"
                : "Cancel class"}
            </Button>
          ) : null}
        </div>
      </Card>
      <div>
        {selected ? (
          <RosterPanel key={selected} sessionId={selected} onSaved={load} />
        ) : (
          <Card className="flex items-center gap-3 text-sm text-neutral-500">
            <CalendarCheck size={18} aria-hidden="true" /> Choose a class to mark attendance.
          </Card>
        )}
      </div>
      {adding ? (
        <AddClassDialog
          batches={batches}
          onClose={() => setAdding(false)}
          onAdded={(id) => {
            setAdding(false);
            setSelected(id);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function AddClassDialog({
  batches,
  onClose,
  onAdded,
}: {
  batches: CohortView[];
  onClose: () => void;
  onAdded: (id: string) => void;
}) {
  const api = useDeskApi();
  const [form, setForm] = React.useState({
    cohortId: batches[0]?.id ?? "",
    date: todayIso(),
    start: "18:00",
    end: "19:30",
    mode: "OFFLINE" as "OFFLINE" | "ONLINE",
    topic: "",
  });
  const [error, setError] = React.useState<string | null>(null);
  return (
    <Modal title="Add an extra class" onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const s = await api.addSession({ ...form, topic: form.topic || undefined });
            onAdded(s.id);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't add the class");
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ac-batch">Batch</Label>
          <select
            id="ac-batch"
            className={selectCls}
            value={form.cohortId}
            onChange={(e) => setForm({ ...form, cohortId: e.target.value })}
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ac-date">Date</Label>
            <Input
              id="ac-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ac-start">Starts</Label>
            <Input
              id="ac-start"
              type="time"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ac-end">Ends</Label>
            <Input
              id="ac-end"
              type="time"
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ac-mode">Class is</Label>
          <select
            id="ac-mode"
            className={selectCls}
            value={form.mode}
            onChange={(e) => setForm({ ...form, mode: e.target.value as "OFFLINE" | "ONLINE" })}
          >
            <option value="OFFLINE">Offline (classroom)</option>
            <option value="ONLINE">Online</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ac-topic">Topic (optional)</Label>
          <Input
            id="ac-topic"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="Doubt-clearing session"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add class</Button>
        </div>
      </form>
    </Modal>
  );
}

function RegisterTab({ batches }: { batches: CohortView[] }) {
  const api = useDeskApi();
  const [cohortId, setCohortId] = React.useState(batches[0]?.id ?? "");
  const [period, setPeriod] = React.useState<AttendancePeriod>("monthly");
  const [date, setDate] = React.useState(todayIso());
  const [grid, setGrid] = React.useState<AttendanceGrid | null>(null);
  const [error, setError] = React.useState(false);

  const range = React.useMemo(() => {
    if (period === "daily") return { from: date, to: date };
    if (period === "weekly") {
      const d = new Date(`${date}T00:00:00Z`);
      const dow = d.getUTCDay();
      const from = addDaysIso(date, dow === 0 ? -6 : 1 - dow);
      return { from, to: addDaysIso(from, 6) };
    }
    return monthBounds(monthOf(date));
  }, [period, date]);

  const load = React.useCallback(() => {
    if (!cohortId) return;
    setError(false);
    setGrid(null);
    api
      .grid(cohortId, range.from, range.to)
      .then(setGrid)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId, range.from, range.to]);
  React.useEffect(() => load(), [load]);

  const shift = (n: number) =>
    setDate((d) =>
      period === "monthly"
        ? `${shiftMonth(monthOf(d), n)}-01`
        : addDaysIso(d, period === "weekly" ? 7 * n : n),
    );

  if (!batches.length) return <Card className="text-sm text-neutral-500">No batches yet.</Card>;
  const sessions = grid?.sessions.filter((s) => !s.cancelled) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card density="compact" className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Batch"
          className={selectCls}
          value={cohortId}
          onChange={(e) => setCohortId(e.target.value)}
        >
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <div
          role="tablist"
          aria-label="Period"
          className="flex rounded-md border border-neutral-300 p-0.5 dark:border-neutral-700"
        >
          {(["daily", "weekly", "monthly"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium capitalize",
                period === p
                  ? "bg-primary-600 text-white"
                  : "text-neutral-600 dark:text-neutral-300",
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" aria-label="Previous" onClick={() => shift(-1)}>
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-medium">
            {period === "monthly"
              ? MONTH_FMT.format(new Date(`${range.from}T00:00:00Z`))
              : period === "weekly"
                ? `${dayLabel(range.from)} – ${dayLabel(range.to)}`
                : dayLabel(range.from)}
          </span>
          <Button size="sm" variant="ghost" aria-label="Next" onClick={() => shift(1)}>
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
        <div className="ml-auto">
          <ExcelBar
            onDownload={() =>
              api.download(
                api.attendanceExportPath(cohortId, period, range.from, false),
                "attendance.xlsx",
              )
            }
            onTemplate={() =>
              api.download(
                api.attendanceExportPath(cohortId, period, range.from, true),
                "attendance-template.xlsx",
              )
            }
            onUpload={(b64, name, dry) => api.importAttendance(cohortId, b64, name, dry)}
            onImported={() => load()}
          />
        </div>
      </Card>

      {error ? (
        <RetryInline message="Couldn't load the register" onRetry={load} />
      ) : !grid ? (
        <Card className="text-sm text-neutral-500">Loading…</Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <ToneCard tone={percentTone(grid.percent)} className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Batch attendance
              </p>
              <p className="mt-1 font-heading text-2xl font-semibold">
                {grid.percent === null ? "—" : `${grid.percent}%`}
              </p>
              <div className="mt-2">
                <Meter value={grid.percent} tone={percentTone(grid.percent)} />
              </div>
            </ToneCard>
            <ToneCard tone="indigo" index={1} className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Classes
              </p>
              <p className="mt-1 font-heading text-2xl font-semibold">
                {sessions.filter((s) => s.taken).length}
                <span className="text-base font-normal text-neutral-500">
                  {" "}
                  / {sessions.length} marked
                </span>
              </p>
            </ToneCard>
            <ToneCard tone="rose" index={2} className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Below 75%
              </p>
              <p className="mt-1 font-heading text-2xl font-semibold">
                {grid.rows.filter((r) => r.percent !== null && r.percent < 75).length}
              </p>
              <p className="text-xs text-neutral-500">students</p>
            </ToneCard>
          </div>
          <Card density="compact" className="overflow-x-auto p-0">
            <table className="min-w-full text-xs">
              <thead className="bg-neutral-50 text-left dark:bg-white/[0.03]">
                <tr>
                  <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 font-medium dark:bg-neutral-900">
                    Student
                  </th>
                  {sessions.map((s) => (
                    <th
                      key={s.id}
                      className="whitespace-nowrap px-1.5 py-2 text-center font-medium"
                    >
                      <span className="block">
                        {dayLabel(s.date).split(" ").slice(0, 2).join(" ")}
                      </span>
                      <span className="font-normal text-neutral-400">{s.start}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((r) => (
                  <tr
                    key={r.userId}
                    className="border-t border-neutral-100 dark:border-neutral-800"
                  >
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 font-medium dark:bg-neutral-900">
                      {r.name}
                    </td>
                    {sessions.map((s) => {
                      const i = grid.sessions.findIndex((x) => x.id === s.id);
                      const st = r.statuses[i];
                      return (
                        <td key={s.id} className="px-1 py-1 text-center">
                          <span
                            title={
                              st ? ATTENDANCE_LABEL[st] : s.taken ? "Not marked" : "Not taken yet"
                            }
                            className={cn(
                              "inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold",
                              st ? CELL[st] : "text-neutral-300",
                            )}
                          >
                            {st ? STATUS_STYLE[st].letter : "·"}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-1.5 text-right">
                      <Pill tone={percentTone(r.percent)}>
                        {r.percent === null ? "—" : `${r.percent}%`}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function OverviewTab() {
  const api = useDeskApi();
  const [month, setMonth] = React.useState(monthOf(todayIso()));
  const [rows, setRows] = React.useState<AttendanceOverviewRow[] | null>(null);
  React.useEffect(() => {
    setRows(null);
    api
      .overview(month)
      .then(setRows)
      .catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);
  const courses = [...new Set((rows ?? []).map((r) => r.courseTitle ?? "No course"))];
  return (
    <div className="flex flex-col gap-4">
      <Card density="compact" className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          aria-label="Previous month"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </Button>
        <span className="min-w-[10rem] text-center text-sm font-medium">
          {MONTH_FMT.format(new Date(`${month}-01T00:00:00Z`))}
        </span>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Next month"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </Card>
      {rows === null ? (
        <Card className="text-sm text-neutral-500">Loading…</Card>
      ) : rows.length === 0 ? (
        <Card className="text-sm text-neutral-500">No batches.</Card>
      ) : (
        courses.map((course) => (
          <section key={course}>
            <SectionTitle>{course}</SectionTitle>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows
                .filter((r) => (r.courseTitle ?? "No course") === course)
                .map((r, i) => (
                  <li key={r.cohortId}>
                    <ToneCard tone={percentTone(r.percent)} index={i} className="p-4">
                      <p className="font-medium text-neutral-900 dark:text-white">{r.cohortName}</p>
                      <p className="text-xs text-neutral-500">
                        <Users size={11} aria-hidden="true" className="mr-1 inline" />
                        {r.students} students{r.mentor ? ` · ${r.mentor}` : ""}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <Meter value={r.percent} tone={percentTone(r.percent)} />
                        <span className="w-12 text-right text-sm font-semibold">
                          {r.percent === null ? "—" : `${r.percent}%`}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-neutral-500">
                        {r.classesHeld} classes marked
                        {r.classesPending ? ` · ${r.classesPending} not marked` : ""}
                        {r.lowAttendance ? ` · ${r.lowAttendance} below 75%` : ""}
                      </p>
                    </ToneCard>
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function AttendanceContent() {
  const params = useSearchParams();
  const studentApi = useStudentAdminApi();
  const [tab, setTab] = React.useState<"mark" | "register" | "overview">("mark");
  const [batches, setBatches] = React.useState<CohortView[] | null>(null);
  React.useEffect(() => {
    studentApi
      .cohorts()
      .then((b) => setBatches(b.filter((x) => x.isActive)))
      .catch(() => setBatches([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Attendance"
        subtitle="Classes come from each batch's timetable (India time). Mark Present, Late, Absent or Excused; excused classes don't count against a student."
      />
      <div role="tablist" aria-label="Attendance views" className="flex gap-1.5">
        {(
          [
            ["mark", "Mark attendance"],
            ["register", "Batch register"],
            ["overview", "Course & month"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              tab === k
                ? "bg-primary-600 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {batches === null ? (
        <Card className="text-sm text-neutral-500">Loading…</Card>
      ) : tab === "mark" ? (
        <MarkTab batches={batches} initialSession={params.get("session")} />
      ) : tab === "register" ? (
        <RegisterTab batches={batches} />
      ) : (
        <OverviewTab />
      )}
    </main>
  );
}

export default function AttendancePage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <React.Suspense fallback={null}>
        <AttendanceContent />
      </React.Suspense>
    </RequirePermission>
  );
}
