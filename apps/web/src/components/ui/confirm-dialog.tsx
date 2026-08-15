"use client";

import * as React from "react";
import { cn } from "@examora/ui";

/** Generic yes/no confirmation — same overlay/focus/Escape pattern as quiz/assignment SubmitConfirmDialog. Shared across every admin module. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "primary",
  submitting,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  submitting: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/40" onClick={onCancel} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-sm rounded-card border border-neutral-900/[0.06] bg-white p-6 shadow-soft-hover"
      >
        <h2
          id="confirm-dialog-title"
          className="font-heading text-lg font-semibold text-neutral-900"
        >
          {title}
        </h2>
        <div className="mt-2 text-sm text-neutral-600">{message}</div>
        {error ? <p className="mt-3 text-sm text-danger-600">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className={cn(
              "flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60",
              tone === "danger"
                ? "bg-danger-600 hover:bg-danger-700"
                : "bg-primary-600 hover:bg-primary-700",
            )}
          >
            {submitting ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
