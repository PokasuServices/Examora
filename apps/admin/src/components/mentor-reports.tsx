"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  FileText,
  Flame,
  ListChecks,
  RefreshCw,
  Send,
  Target,
} from "lucide-react";
import {
  REPORT_KIND_LABEL,
  type CohortView,
  type ProgressReportKind,
  type ProgressReportStatus,
  type ProgressReportView,
} from "@examora/types";
import { Button, Label, cn } from "@examora/ui";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import {
  ExcelBar,
  Modal,
  Pill,
  ToneCard,
  ToneIcon,
  percentTone,
  timeAgo,
  todayIso,
  useToast,
  type Tone,
} from "@/components/desk-ui";
import { useDeskApi } from "@/lib/desk-api";
import { useStudentAdminApi } from "@/lib/student-admin-api";

export const STATUS: Record<ProgressReportStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "slate" },
  SUBMITTED: { label: "With the admin", tone: "cyan" },
  RETURNED: { label: "Sent back", tone: "amber" },
  APPROVED: { label: "Approved", tone: "emerald" },
};

const MONTH_FMT = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
export function periodLabel(r: { kind: string; period: string }) {
  return /^\d{4}-\d{2}$/.test(r.period)
    ? MONTH_FMT.format(new Date(`${r.period}-01T00:00:00Z`))
    : r.period;
}

export function SummaryTiles({ r }: { r: ProgressReportView }) {
  const s = r.summary;
  const tiles: { label: string; value: string; tone: Tone; icon: typeof CalendarCheck }[] = [
    {
      label: "Attendance",
      value: s.attendancePercent === null ? "—" : `${s.attendancePercent}%`,
      tone: percentTone(s.attendancePercent),
      icon: CalendarCheck,
    },
    {
      label: "Absences",
      value: `${s.absences} of ${s.classesHeld}`,
      tone: s.absences > 3 ? "rose" : "slate",
      icon: AlertTriangle,
    },
    {
      label: "Quiz average",
      value: s.avgQuizPercent === null ? "—" : `${s.avgQuizPercent}%`,
      tone: percentTone(s.avgQuizPercent),
      icon: ListChecks,
    },
    { label: "Tests taken", value: String(s.quizzesTaken), tone: "indigo", icon: Target },
    { label: "Daily quiz days", value: String(s.dailyQuizDays), tone: "amber", icon: Flame },
    { label: "Lessons done", value: String(s.lessonsCompleted), tone: "violet", icon: BookOpen },
    {
      label: "Assignments",
      value: `${s.assignmentsSubmitted} in${s.assignmentsMissing ? ` · ${s.assignmentsMissing} missed` : ""}`,
      tone: s.assignmentsMissing ? "rose" : "cyan",
      icon: ClipboardList,
    },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {tiles.map((t, i) => (
        <ToneCard key={t.label} tone={t.tone} index={i} className="p-3">
          <div className="flex items-center gap-2">
            <ToneIcon tone={t.tone} icon={t.icon} size="sm" />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                {t.label}
              </p>
              <p className="font-heading text-lg font-semibold">{t.value}</p>
            </div>
          </div>
        </ToneCard>
      ))}
      {s.weakTopics.length ? (
        <ToneCard tone="rose" index={7} className="p-3 sm:col-span-3 lg:col-span-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            Topics to work on
          </p>
          <p className="mt-1 text-sm">{s.weakTopics.join(" · ")}</p>
        </ToneCard>
      ) : null}
    </div>
  );
}

function Editor({ id, onChanged }: { id: string; onChanged: () => void }) {
  const api = useDeskApi();
  const { toast, toastError, node } = useToast();
  const [r, setR] = React.useState<ProgressReportView | null>(null);
  const [remarks, setRemarks] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  React.useEffect(() => {
    setR(null);
    api
      .report(id)
      .then((x) => {
        setR(x);
        setRemarks(x.remarks);
      })
      .catch((e) => toastError(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!r) return <Card className="text-sm text-neutral-500">Loading…</Card>;
  const editable = r.status === "DRAFT" || r.status === "RETURNED";

  async function act(key: string, fn: () => Promise<ProgressReportView>, msg: string) {
    setBusy(key);
    try {
      const x = await fn();
      setR(x);
      setRemarks(x.remarks);
      toast(msg);
      onChanged();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <ToneCard tone={STATUS[r.status].tone} className="p-5">
      {node}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {REPORT_KIND_LABEL[r.kind]} · {periodLabel(r)}
          </p>
          <h2 className="font-heading text-lg font-semibold text-neutral-900 dark:text-white">
            {r.student.name}
          </h2>
          <p className="text-xs text-neutral-500">
            {r.student.email}
            {r.cohort ? ` · ${r.cohort.name}` : ""}
          </p>
        </div>
        <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
      </div>
      {r.status === "RETURNED" && r.adminNote ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <strong>Admin:</strong> {r.adminNote}
        </p>
      ) : r.status === "APPROVED" && r.adminNote ? (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
          <strong>Admin:</strong> {r.adminNote}
        </p>
      ) : null}
      <div className="mt-4">
        <SummaryTiles r={r} />
      </div>
      <div className="mt-4">
        <Label htmlFor="remarks">Your remarks</Label>
        <textarea
          id="remarks"
          value={remarks}
          readOnly={!editable}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Strengths, what to improve, and how the parent can help…"
          className="mt-1 min-h-32 w-full rounded-md border border-neutral-300 bg-white p-3 text-sm read-only:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      {editable ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!!busy}
            onClick={() =>
              void act(
                "refresh",
                () => api.updateReport(id, { refresh: true }),
                "Numbers refreshed",
              )
            }
          >
            <RefreshCw size={14} aria-hidden="true" /> Refresh numbers
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!!busy}
            onClick={() => void act("save", () => api.updateReport(id, { remarks }), "Saved")}
          >
            Save draft
          </Button>
          <Button
            size="sm"
            disabled={!!busy || remarks.trim().length < 10}
            onClick={() =>
              void act(
                "send",
                async () => {
                  await api.updateReport(id, { remarks });
                  return api.submitReport(id);
                },
                "Sent to the admin for approval",
              )
            }
          >
            <Send size={14} aria-hidden="true" /> Send to admin
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-neutral-500">
          {r.status === "SUBMITTED"
            ? `Sent ${timeAgo(r.submittedAt)}. The admin approves it before it reaches parents.`
            : `Approved ${timeAgo(r.decidedAt)}.`}
        </p>
      )}
    </ToneCard>
  );
}

function NewReportDialog({
  initialStudent,
  initialKind,
  onClose,
  onCreated,
}: {
  initialStudent: string | null;
  initialKind: ProgressReportKind;
  onClose: () => void;
  onCreated: (r: ProgressReportView) => void;
}) {
  const api = useDeskApi();
  const studentApi = useStudentAdminApi();
  const [students, setStudents] = React.useState<{ userId: string; name: string; batch: string }[]>(
    [],
  );
  const [studentId, setStudentId] = React.useState(initialStudent ?? "");
  const [kind, setKind] = React.useState<ProgressReportKind>(initialKind);
  const [remarks, setRemarks] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    void (async () => {
      const batches: CohortView[] = await studentApi.cohorts();
      const all: { userId: string; name: string; batch: string }[] = [];
      for (const b of batches) {
        const m = await studentApi.cohortMembers(b.id);
        for (const x of m)
          if (!all.some((a) => a.userId === x.userId))
            all.push({ userId: x.userId, name: x.name, batch: b.name });
      }
      setStudents(all.sort((a, b) => a.name.localeCompare(b.name)));
    })().catch(() => setStudents([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Modal title="New report" onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            onCreated(
              await api.createReport({
                studentId,
                kind,
                period: kind === "MONTHLY" ? todayIso().slice(0, 7) : todayIso(),
                remarks,
              }),
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't create the report");
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nr-student">Student</Label>
          <select
            id="nr-student"
            required
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="">Choose…</option>
            {students.map((s) => (
              <option key={s.userId} value={s.userId}>
                {s.name} · {s.batch}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium">Type</legend>
          {(["MONTHLY", "ALERT", "PTM"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />{" "}
              {REPORT_KIND_LABEL[k]}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nr-remarks">
            {kind === "ALERT"
              ? "What happened"
              : kind === "PTM"
                ? "Meeting notes"
                : "Remarks (you can add them later)"}
          </Label>
          <textarea
            id="nr-remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="min-h-24 rounded-md border border-neutral-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
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
          <Button type="submit" disabled={!studentId}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function MentorReports() {
  const api = useDeskApi();
  const params = useSearchParams();
  const { toast, toastError, node } = useToast();
  const [rows, setRows] = React.useState<ProgressReportView[] | null>(null);
  const [error, setError] = React.useState(false);
  const [filter, setFilter] = React.useState<ProgressReportStatus | "ALL">(
    (params.get("status") as ProgressReportStatus) ?? "ALL",
  );
  const [selected, setSelected] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState<{
    kind: ProgressReportKind;
    student: string | null;
  } | null>(
    params.get("new")
      ? {
          kind: (params.get("new") as ProgressReportKind) ?? "MONTHLY",
          student: params.get("student"),
        }
      : null,
  );
  const load = React.useCallback(() => {
    setError(false);
    api
      .reports()
      .then((r) => {
        setRows(r);
        setSelected((s) => s ?? r[0]?.id ?? null);
      })
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => load(), [load]);
  const shown = (rows ?? []).filter((r) => filter === "ALL" || r.status === filter);
  const count = (s: ProgressReportStatus) => (rows ?? []).filter((r) => r.status === s).length;
  const month = todayIso().slice(0, 7);

  return (
    <main className="flex flex-col gap-6">
      {node}
      <PageHeader
        title="Reports"
        subtitle="Monthly report cards, alerts and parent–teacher meeting notes. Each goes to the admin dashboard and is approved before parents see it."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  const r = await api.prepareMonth(month);
                  toast(
                    r.created
                      ? `${r.created} report-card drafts ready for ${periodLabel({ kind: "MONTHLY", period: month })}`
                      : "Every student already has this month's draft",
                  );
                  load();
                } catch (e) {
                  toastError(e);
                }
              }}
            >
              <FilePlus2 size={14} aria-hidden="true" /> Prepare this month&rsquo;s report cards
            </Button>
            <Button size="sm" onClick={() => setCreating({ kind: "MONTHLY", student: null })}>
              <FileText size={14} aria-hidden="true" /> New report
            </Button>
          </div>
        }
      />
      <div role="tablist" aria-label="Filter" className="flex flex-wrap gap-1.5">
        {(["ALL", "DRAFT", "RETURNED", "SUBMITTED", "APPROVED"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              filter === f
                ? "bg-primary-600 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300",
            )}
          >
            {f === "ALL" ? "All" : STATUS[f].label}
            {f !== "ALL" ? <span className="ml-1 opacity-75">{count(f)}</span> : null}
          </button>
        ))}
      </div>
      {error ? (
        <RetryInline message="Couldn't load reports" onRetry={load} />
      ) : rows === null ? (
        <Card className="text-sm text-neutral-500">Loading…</Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            heading="No reports here"
            body="Prepare this month's report cards to start."
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <Card density="compact" className="self-start p-0">
            <ul className="max-h-[40rem] divide-y divide-neutral-200 overflow-y-auto dark:divide-neutral-800">
              {shown.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.id)}
                    aria-current={selected === r.id ? "true" : undefined}
                    className={cn(
                      "flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-white/[0.03]",
                      selected === r.id && "bg-primary-50 dark:bg-primary-500/15",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{r.student.name}</span>
                      <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
                    </span>
                    <span className="text-xs text-neutral-500">
                      {REPORT_KIND_LABEL[r.kind]} · {periodLabel(r)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {selected ? <Editor key={selected} id={selected} onChanged={load} /> : null}
        </div>
      )}
      {creating ? (
        <NewReportDialog
          initialKind={creating.kind}
          initialStudent={creating.student}
          onClose={() => setCreating(null)}
          onCreated={(r) => {
            setCreating(null);
            setSelected(r.id);
            setFilter("ALL");
            load();
          }}
        />
      ) : null}
    </main>
  );
}

/** Admin dashboard side: approve or send back mentor reports; download the log. */
export function AdminReportsQueue() {
  const api = useDeskApi();
  const { toast, toastError, node } = useToast();
  const [status, setStatus] = React.useState<"SUBMITTED" | "APPROVED" | "RETURNED">("SUBMITTED");
  const [rows, setRows] = React.useState<ProgressReportView[] | null>(null);
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const load = React.useCallback(() => {
    setRows(null);
    api
      .reports({ status })
      .then(setRows)
      .catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  React.useEffect(() => load(), [load]);

  async function decide(r: ProgressReportView, approve: boolean) {
    try {
      if (approve) await api.approveReport(r.id, notes[r.id] || undefined);
      else await api.returnReport(r.id, notes[r.id] ?? "");
      toast(approve ? "Approved" : "Sent back to the mentor");
      load();
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Status" className="flex gap-1.5">
          {(["SUBMITTED", "RETURNED", "APPROVED"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                status === s
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300",
              )}
            >
              {s === "SUBMITTED" ? "Waiting for you" : STATUS[s].label}
            </button>
          ))}
        </div>
        <ExcelBar
          downloadLabel="Download approved reports"
          onDownload={() =>
            api.download("/staff-requests/reports/export?status=APPROVED", "mentor-reports.xlsx")
          }
        />
      </div>
      {rows === null ? (
        <Card className="text-sm text-neutral-500">Loading…</Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={CheckCircle2} heading="Nothing waiting" />
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((r) => (
            <li key={r.id}>
              <ToneCard tone={STATUS[r.status].tone} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      {REPORT_KIND_LABEL[r.kind]} · {periodLabel(r)} · by {r.mentor.name}
                    </p>
                    <h3 className="font-heading text-base font-semibold">{r.student.name}</h3>
                    <p className="text-xs text-neutral-500">
                      {r.student.email}
                      {r.cohort ? ` · ${r.cohort.name}` : ""}
                    </p>
                  </div>
                  <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
                </div>
                <div className="mt-3">
                  <SummaryTiles r={r} />
                </div>
                <p className="mt-3 whitespace-pre-wrap rounded-md bg-white p-3 text-sm shadow-soft dark:bg-neutral-900">
                  {r.remarks}
                </p>
                {r.status === "SUBMITTED" ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <label htmlFor={`n-${r.id}`} className="text-xs font-medium text-neutral-600">
                      Note to {r.mentor.name} (required to send back)
                    </label>
                    <input
                      id={`n-${r.id}`}
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                      placeholder="e.g. Shared with the parent"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={(notes[r.id] ?? "").trim().length < 3}
                        onClick={() => void decide(r, false)}
                      >
                        Send back
                      </Button>
                      <Button size="sm" onClick={() => void decide(r, true)}>
                        Approve
                      </Button>
                    </div>
                  </div>
                ) : r.adminNote ? (
                  <p className="mt-2 text-xs text-neutral-500">Note: {r.adminNote}</p>
                ) : null}
              </ToneCard>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
