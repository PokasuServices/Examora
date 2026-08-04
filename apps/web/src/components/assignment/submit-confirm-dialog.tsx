"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

export function SubmitConfirmDialog({
  open,
  fileCount,
  submitting,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  fileCount: number;
  submitting: boolean;
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
        aria-labelledby="submit-dialog-title"
        className="relative w-full max-w-sm rounded-card border border-neutral-900/[0.06] bg-white p-6 shadow-soft-hover"
      >
        <h2
          id="submit-dialog-title"
          className="font-heading text-lg font-semibold text-neutral-900"
        >
          Submit this assignment?
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          {fileCount} {fileCount === 1 ? "file" : "files"} attached.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-md border border-warning-500/30 bg-warning-50 px-3 py-2 text-sm text-warning-700">
          <AlertTriangle
            size={16}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>You won&rsquo;t be able to add or remove files after submitting.</span>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Keep editing
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="flex h-10 items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
