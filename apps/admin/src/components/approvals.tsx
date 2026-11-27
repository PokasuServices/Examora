"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileEdit,
  FileText,
  Send,
  Trash2,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useAuth } from "@examora/auth-client";
import { STAFF_REQUEST_LABEL, type StaffRequestKind, type StaffRequestView } from "@examora/types";
import { Button, cn } from "@examora/ui";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { DeletionSection } from "@/components/deletion-requests";
import { AdminReportsQueue } from "@/components/mentor-reports";
import { Pill, ToneCard, ToneIcon, timeAgo, useToast, type Tone } from "@/components/desk-ui";
import { useDeskApi } from "@/lib/desk-api";

const KIND_STYLE: Record<StaffRequestKind, { tone: Tone; icon: typeof FileEdit }> = {
  CONTENT_CHANGE: { tone: "violet", icon: FileEdit },
  CONTENT_PUBLISH: { tone: "cyan", icon: Send },
  NEW_STUDENT: { tone: "emerald", icon: UserPlus },
};
const STATUS_STYLE = {
  PENDING: { label: "Waiting for review", tone: "amber" as Tone, icon: Clock },
  APPROVED: { label: "Approved", tone: "emerald" as Tone, icon: CheckCircle2 },
  REJECTED: { label: "Sent back", tone: "rose" as Tone, icon: XCircle },
};
const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  description: "Description",
  content: "Content",
  contentType: "Content type",
  videoUrl: "Video",
  durationMinutes: "Duration (min)",
  timeLimitMinutes: "Time limit (min)",
  note: "Note",
};

function RequestCard({
  r,
  canDecide,
  onDecided,
  index,
}: {
  r: StaffRequestView;
  canDecide: boolean;
  onDecided: () => void;
  index: number;
}) {
  const api = useDeskApi();
  const { toast, toastError, node } = useToast();
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const k = KIND_STYLE[r.kind];
  const s = STATUS_STYLE[r.status];

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      if (approve) await api.approveRequest(r.id, note.trim() || undefined);
      else await api.rejectRequest(r.id, note.trim());
      toast(
        approve
          ? r.kind === "NEW_STUDENT"
            ? "Student added to the batch"
            : "Approved and applied"
          : "Sent back with your note",
      );
      onDecided();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToneCard tone={k.tone} index={index} className="p-5">
      {node}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ToneIcon tone={k.tone} icon={k.icon} size="sm" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {STAFF_REQUEST_LABEL[r.kind]}
              {r.kind !== "NEW_STUDENT" ? ` · ${r.targetType}` : ""}
            </p>
            <p className="font-semibold text-neutral-900 dark:text-white">
              {r.kind === "NEW_STUDENT" ? r.student?.name : r.targetLabel}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {r.requestedBy.name} · {timeAgo(r.createdAt)}
            </p>
          </div>
        </div>
        <Pill tone={s.tone}>
          <s.icon size={12} aria-hidden="true" /> {s.label}
        </Pill>
      </div>

      {r.kind === "CONTENT_CHANGE" && r.changes.length ? (
        <dl className="mt-4 flex flex-col gap-2">
          {r.changes.map((c) => (
            <div
              key={c.field}
              className="rounded-md bg-white p-3 text-sm shadow-soft dark:bg-neutral-900"
            >
              <dt className="text-xs font-medium text-neutral-500">
                {FIELD_LABEL[c.field] ?? c.field}
              </dt>
              <dd className="mt-1 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
                <span className="rounded bg-rose-50 px-2 py-1 text-rose-900 line-through decoration-rose-400/60 dark:bg-rose-500/10 dark:text-rose-200">
                  {c.before || "(empty)"}
                </span>
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="hidden text-neutral-400 sm:mt-1.5 sm:block"
                />
                <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {c.after || "(empty)"}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {r.kind === "NEW_STUDENT" && r.student ? (
        <p className="mt-3 rounded-md bg-white p-3 text-sm shadow-soft dark:bg-neutral-900">
          {r.student.email}
          {r.student.phone ? ` · ${r.student.phone}` : ""} → <strong>{r.student.cohortName}</strong>
          <span className="mt-1 block text-xs text-neutral-500">
            Approving creates a student account if needed (they set a password with &ldquo;Forgot
            password&rdquo;) and adds them to the batch. Assign their course licence from
            Enrollments.
          </span>
        </p>
      ) : null}
      {r.note ? (
        <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
          <strong>Mentor&rsquo;s note:</strong> {r.note}
        </p>
      ) : null}

      {r.status !== "PENDING" ? (
        <p className="mt-3 text-xs text-neutral-500">
          {r.decidedBy ? `${r.decidedBy.name} · ` : ""}
          {timeAgo(r.decidedAt)}
          {r.decisionNote ? ` · “${r.decisionNote}”` : ""}
        </p>
      ) : canDecide ? (
        <div className="mt-4 flex flex-col gap-2">
          <label
            htmlFor={`sr-${r.id}`}
            className="text-xs font-medium text-neutral-600 dark:text-neutral-400"
          >
            Note to {r.requestedBy.name} (required to send back)
          </label>
          <input
            id={`sr-${r.id}`}
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || note.trim().length < 3}
              onClick={() => void decide(false)}
            >
              Send back
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void decide(true)}>
              {r.kind === "NEW_STUDENT"
                ? "Approve & add student"
                : r.kind === "CONTENT_PUBLISH"
                  ? "Approve & publish"
                  : "Approve & apply"}
            </Button>
          </div>
        </div>
      ) : null}
    </ToneCard>
  );
}

function RequestsSection({ kinds, canDecide }: { kinds: StaffRequestKind[]; canDecide: boolean }) {
  const api = useDeskApi();
  const [status, setStatus] = React.useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">(
    "PENDING",
  );
  const [rows, setRows] = React.useState<StaffRequestView[] | null>(null);
  const [error, setError] = React.useState(false);
  const load = React.useCallback(() => {
    setError(false);
    (canDecide ? api.staffRequests() : api.myRequests())
      .then((r) => setRows(r.filter((x) => kinds.includes(x.kind))))
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canDecide, kinds.join()]);
  React.useEffect(() => load(), [load]);
  const shown = (rows ?? []).filter((r) => status === "ALL" || r.status === status);
  const count = (s: string) => (rows ?? []).filter((r) => r.status === s).length;
  return (
    <section className="flex flex-col gap-4">
      <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1.5">
        {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={status === f}
            onClick={() => setStatus(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              status === f
                ? "bg-primary-600 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300",
            )}
          >
            {f === "ALL" ? "All" : STATUS_STYLE[f].label}
            {f !== "ALL" ? <span className="ml-1 opacity-75">{count(f)}</span> : null}
          </button>
        ))}
      </div>
      {error ? (
        <RetryInline message="Couldn't load requests" onRetry={load} />
      ) : rows === null ? (
        <Card className="text-sm text-neutral-500">Loading…</Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckCircle2}
            heading={status === "PENDING" ? "Nothing waiting" : "No requests here"}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((r, i) => (
            <li key={r.id}>
              <RequestCard r={r} canDecide={canDecide} onDecided={load} index={i} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Tab = "content" | "students" | "deletions" | "reports";

export function ApprovalsContent() {
  const { user } = useAuth();
  const params = useSearchParams();
  const canDecide = user?.permissions.includes("deletion:review") ?? false;
  const [tab, setTab] = React.useState<Tab>((params.get("tab") as Tab) ?? "content");
  const tabs: { key: Tab; label: string; icon: typeof FileEdit }[] = [
    { key: "content", label: "Content changes", icon: FileEdit },
    { key: "students", label: "New students", icon: UserPlus },
    { key: "deletions", label: "Deletion requests", icon: Trash2 },
    ...(canDecide ? [{ key: "reports" as Tab, label: "Reports", icon: FileText }] : []),
  ];
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={canDecide ? "Approvals" : "My requests"}
        subtitle={
          canDecide
            ? "Everything mentors sent you: edits to live content, drafts to publish, new students, deletions and reports. Approve, or send back with a note."
            : "What you sent the admin and what they decided. Mock tests, quizzes and assignments don't need approval."
        }
        actions={
          !canDecide ? (
            <Link
              href="/student-reports"
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              My reports →
            </Link>
          ) : undefined
        }
      />
      <div
        role="tablist"
        aria-label="Request type"
        className="flex flex-wrap gap-1.5 border-b border-neutral-200 dark:border-neutral-800"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.key
                ? "border-primary-600 text-primary-700 dark:text-primary-300"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
            )}
          >
            <t.icon size={15} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>
      {tab === "content" ? (
        <RequestsSection kinds={["CONTENT_CHANGE", "CONTENT_PUBLISH"]} canDecide={canDecide} />
      ) : tab === "students" ? (
        <RequestsSection kinds={["NEW_STUDENT"]} canDecide={canDecide} />
      ) : tab === "deletions" ? (
        <DeletionSection />
      ) : (
        <AdminReportsQueue />
      )}
    </main>
  );
}
