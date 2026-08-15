"use client";

import * as React from "react";
import type { CmsContentVersionDto, CmsVersionDiffEntry } from "@examora/types";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { statusLabel } from "@/components/orders/format";

function fieldValueLabel(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.length > 80 ? `${value.slice(0, 80)}…` : value;
  return JSON.stringify(value);
}

export function VersionHistoryPanel({
  status,
  versions,
  mutationStatus,
  mutationError,
  onCompare,
  onRestore,
  onRetry,
}: {
  status: "loading" | "ready" | "not-found" | "error";
  versions: CmsContentVersionDto[];
  mutationStatus: "idle" | "submitting" | "error";
  mutationError: string | null;
  onCompare: (from: number, to: number) => Promise<CmsVersionDiffEntry[] | null>;
  onRestore: (versionNumber: number) => Promise<boolean>;
  onRetry: () => void;
}) {
  const [compareFrom, setCompareFrom] = React.useState<number | null>(null);
  const [compareTo, setCompareTo] = React.useState<number | null>(null);
  const [diff, setDiff] = React.useState<CmsVersionDiffEntry[] | null>(null);
  const [comparing, setComparing] = React.useState(false);
  const [restoring, setRestoring] = React.useState<number | null>(null);

  async function runCompare(): Promise<void> {
    if (compareFrom === null || compareTo === null) return;
    setComparing(true);
    const result = await onCompare(compareFrom, compareTo);
    setDiff(result);
    setComparing(false);
  }

  async function confirmRestore(): Promise<void> {
    if (restoring === null) return;
    const ok = await onRestore(restoring);
    if (ok) setRestoring(null);
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (status === "error") {
    return <RetryInline message="Couldn't load version history" onRetry={onRetry} />;
  }

  if (versions.length === 0) {
    return (
      <EmptyState
        heading="No version history yet"
        body="Versions are recorded as this content is edited."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-neutral-100">
        {versions.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-neutral-800">
                v{v.versionNumber} · {statusLabel(v.status)}
              </p>
              <p className="truncate text-xs text-neutral-500">
                {v.createdByEmail} · {new Date(v.createdAt).toLocaleString()}
                {v.changeNote ? ` — ${v.changeNote}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <label className="flex items-center gap-1 text-xs text-neutral-500">
                <input
                  type="radio"
                  name="compare-from"
                  checked={compareFrom === v.versionNumber}
                  onChange={() => setCompareFrom(v.versionNumber)}
                />
                From
              </label>
              <label className="flex items-center gap-1 text-xs text-neutral-500">
                <input
                  type="radio"
                  name="compare-to"
                  checked={compareTo === v.versionNumber}
                  onChange={() => setCompareTo(v.versionNumber)}
                />
                To
              </label>
              <button
                type="button"
                onClick={() => setRestoring(v.versionNumber)}
                className="text-xs font-medium text-primary-600 hover:underline"
              >
                Restore
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={compareFrom === null || compareTo === null || comparing}
          onClick={() => void runCompare()}
          className="flex h-9 items-center rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-50"
        >
          {comparing ? "Comparing…" : "Compare selected versions"}
        </button>
      </div>

      {diff ? (
        diff.length === 0 ? (
          <p className="text-sm text-neutral-500">No field differences between these versions.</p>
        ) : (
          <div className="overflow-x-auto contain-layout rounded-md border border-neutral-100">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Field
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Before
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    After
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {diff.map((entry) => (
                  <tr key={entry.field}>
                    <td className="px-3 py-2 font-medium text-neutral-700">{entry.field}</td>
                    <td className="px-3 py-2 text-neutral-500">{fieldValueLabel(entry.before)}</td>
                    <td className="px-3 py-2 text-neutral-700">{fieldValueLabel(entry.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      <ConfirmDialog
        open={restoring !== null}
        title="Restore this version?"
        message={
          restoring !== null ? (
            <>
              Restore version {restoring}? This replaces the current content and records a new
              version — it doesn&rsquo;t rewrite history.
            </>
          ) : null
        }
        confirmLabel="Restore"
        submitting={mutationStatus === "submitting"}
        error={mutationError}
        onConfirm={() => void confirmRestore()}
        onCancel={() => setRestoring(null)}
      />
    </div>
  );
}
