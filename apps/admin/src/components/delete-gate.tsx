"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ShieldAlert, Trash2, X } from "lucide-react";
import { ApiError, useAuth } from "@examora/auth-client";
import {
  DELETION_TARGET_LABEL,
  type DeletionPreview,
  type DeletionTargetType,
} from "@examora/types";
import { Button, Label, cn } from "@examora/ui";
import { useStaffApi } from "@/lib/staff-api";

/**
 * Wraps a Delete button. Administrators (deletion:direct) get the button as
 * is; everyone else (mentors) gets "Get review from admin", which explains
 * what would be affected and sends a deletion request with a reason.
 */
export function DeleteGate({
  type,
  id,
  children,
  size = "sm",
  className,
}: {
  type: DeletionTargetType;
  id: string;
  children: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  const { user } = useAuth();
  if (!user || user.permissions.includes("deletion:direct")) return <>{children}</>;
  if (!user.permissions.includes("deletion:request")) return null;
  return <RequestDeletionButton type={type} id={id} size={size} className={className} />;
}

function RequestDeletionButton({
  type,
  id,
  size,
  className,
}: {
  type: DeletionTargetType;
  id: string;
  size: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={size === "sm" ? "sm" : undefined}
        title="Mentors can't delete. An administrator reviews deletion requests."
        onClick={() => setOpen(true)}
        className={cn(
          "text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10",
          className,
        )}
      >
        {sent ? (
          <>
            <CheckCircle2 size={14} aria-hidden="true" /> Review requested
          </>
        ) : (
          <>
            <Trash2 size={14} aria-hidden="true" /> Get review from admin
          </>
        )}
      </Button>
      {open ? (
        <RequestDialog
          type={type}
          id={id}
          onClose={() => setOpen(false)}
          onSent={() => setSent(true)}
        />
      ) : null}
    </>
  );
}

function RequestDialog({
  type,
  id,
  onClose,
  onSent,
}: {
  type: DeletionTargetType;
  id: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const api = useStaffApi();
  const [preview, setPreview] = React.useState<DeletionPreview | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const reasonRef = React.useRef<HTMLTextAreaElement>(null);
  const titleId = React.useId();
  const kind = DELETION_TARGET_LABEL[type];

  React.useEffect(() => {
    api
      .previewDeletion(type, id)
      .then((p) => {
        setPreview(p);
        requestAnimationFrame(() => reasonRef.current?.focus());
      })
      .catch((err: unknown) =>
        setLoadError(err instanceof ApiError ? err.message : "Couldn't load the details"),
      );
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api.requestDeletion(type, id, reason.trim());
      setDone(true);
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-theme-lg dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              <ShieldAlert size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-neutral-900 dark:text-white">
                Get review from admin
              </h2>
              <p className="text-xs text-neutral-500">
                Mentors can&rsquo;t delete. An administrator will approve or decline.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {loadError ? (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {loadError}
          </p>
        ) : !preview ? (
          <p className="mt-4 text-sm text-neutral-500">Loading…</p>
        ) : done ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
            Request sent. You&rsquo;ll get a notification when an administrator decides. Track it
            under{" "}
            <Link href="/approvals" className="font-medium underline">
              Deletion requests
            </Link>
            .
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{kind}</p>
              <p className="mt-0.5 font-medium text-neutral-900 dark:text-white">{preview.label}</p>
              {preview.impact.length > 0 ? (
                <>
                  <p className="mt-3 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    Deleting it would also affect:
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {preview.impact.map((i) => (
                      <li
                        key={i.label}
                        className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
                      >
                        {i.count} {i.label.toLowerCase()}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-xs text-neutral-500">Nothing else depends on it.</p>
              )}
            </div>
            {preview.pendingRequestId ? (
              <p className="mt-4 rounded-md bg-cyan-50 px-3 py-2 text-sm text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200">
                A deletion request for this is already waiting for an administrator.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-1.5">
                <Label htmlFor={`reason-${id}`}>Why should it be deleted?</Label>
                <textarea
                  id={`reason-${id}`}
                  ref={reasonRef}
                  value={reason}
                  maxLength={1000}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Duplicate of the newer version; students should use that one."
                  className="min-h-24 rounded-md border border-neutral-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
            )}
            {error ? (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              {!preview.pendingRequestId ? (
                <Button onClick={() => void send()} disabled={busy || reason.trim().length < 5}>
                  {busy ? "Sending…" : "Send for admin review"}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
