"use client";

import * as React from "react";
import { CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import { ApiError, useAuth } from "@examora/auth-client";
import {
  DELETION_TARGET_LABEL,
  type DeletionRequestStatus,
  type DeletionRequestView,
} from "@examora/types";
import { Button, cn } from "@examora/ui";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { useStaffApi } from "@/lib/staff-api";

const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const STATUS: Record<DeletionRequestStatus, { label: string; cls: string; icon: typeof Clock }> = {
  PENDING: {
    label: "Waiting for review",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved · deleted",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Declined · kept",
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    icon: XCircle,
  },
};

function RequestCard({
  r,
  canDecide,
  onDecided,
}: {
  r: DeletionRequestView;
  canDecide: boolean;
  onDecided: (updated: DeletionRequestView) => void;
}) {
  const api = useStaffApi();
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<"approve" | "reject" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const s = STATUS[r.status];
  const Icon = s.icon;

  async function decide(kind: "approve" | "reject") {
    setBusy(kind);
    setError(null);
    try {
      onDecided(
        kind === "approve"
          ? await api.approveDeletion(r.id, note.trim() || undefined)
          : await api.rejectDeletion(r.id, note.trim()),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the decision");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li>
      <Card className={cn(r.status === "PENDING" && "border-amber-200 dark:border-amber-500/30")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {DELETION_TARGET_LABEL[r.targetType]}
            </p>
            <p className="font-semibold text-neutral-900 dark:text-white">{r.targetLabel}</p>
            <p className="mt-1 text-xs text-neutral-500">
              Asked by {r.requestedBy.name} · {WHEN.format(new Date(r.createdAt))}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
              s.cls,
            )}
          >
            <Icon size={13} aria-hidden="true" /> {s.label}
          </span>
        </div>
        <p className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:bg-white/[0.03] dark:text-neutral-300">
          <strong>Reason:</strong> {r.reason}
        </p>
        {r.impact.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {r.impact.map((i) => (
              <li
                key={i.label}
                className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
              >
                {i.count} {i.label.toLowerCase()}
              </li>
            ))}
          </ul>
        ) : null}
        {r.status !== "PENDING" ? (
          <p className="mt-3 text-xs text-neutral-500">
            {r.decidedBy ? `${r.decidedBy.name} · ` : ""}
            {r.decidedAt ? WHEN.format(new Date(r.decidedAt)) : ""}
            {r.decisionNote ? ` · “${r.decisionNote}”` : ""}
          </p>
        ) : canDecide ? (
          <div className="mt-4 flex flex-col gap-2">
            <label
              htmlFor={`note-${r.id}`}
              className="text-xs font-medium text-neutral-600 dark:text-neutral-400"
            >
              Note to {r.requestedBy.name} (required to decline)
            </label>
            <input
              id={`note-${r.id}`}
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Students still use it this term"
              className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
            {error ? (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                disabled={busy !== null || note.trim().length < 3}
                onClick={() => void decide("reject")}
              >
                {busy === "reject" ? "Declining…" : "Decline, keep it"}
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                disabled={busy !== null}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete ${DELETION_TARGET_LABEL[r.targetType].toLowerCase()} "${r.targetLabel}"?`,
                    )
                  ) {
                    void decide("approve");
                  }
                }}
              >
                {busy === "approve" ? "Deleting…" : "Approve & delete"}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </li>
  );
}

export function DeletionSection() {
  const { user } = useAuth();
  const api = useStaffApi();
  const canDecide = user?.permissions.includes("deletion:review") ?? false;
  const [rows, setRows] = React.useState<DeletionRequestView[] | null>(null);
  const [error, setError] = React.useState(false);
  const [filter, setFilter] = React.useState<DeletionRequestStatus | "ALL">("PENDING");

  const load = React.useCallback(() => {
    setError(false);
    (canDecide ? api.deletionRequests() : api.myDeletionRequests())
      .then(setRows)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canDecide]);
  React.useEffect(() => load(), [load]);

  const shown = (rows ?? []).filter((r) => filter === "ALL" || r.status === filter);
  const count = (s: DeletionRequestStatus) => (rows ?? []).filter((r) => r.status === s).length;

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        {canDecide
          ? "Mentors can't delete. Approve to delete it, or decline with a note."
          : "Things you asked an administrator to delete, and what they decided."}
      </p>
      <div role="tablist" aria-label="Filter requests" className="flex flex-wrap gap-1.5">
        {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((f) => (
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
        <RetryInline message="Couldn't load deletion requests" onRetry={load} />
      ) : rows === null ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            heading={filter === "PENDING" ? "Nothing waiting for review" : "No requests here"}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              canDecide={canDecide}
              onDecided={(u) => setRows((all) => (all ?? []).map((x) => (x.id === u.id ? u : x)))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
