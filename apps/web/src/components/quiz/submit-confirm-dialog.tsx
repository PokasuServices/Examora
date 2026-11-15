"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

export function SubmitConfirmDialog({
  open,
  answeredCount,
  totalCount,
  submitting,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  answeredCount: number;
  totalCount: number;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  const unanswered = totalCount - answeredCount;

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
        className="relative w-full max-w-sm rounded-card border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-soft-hover"
      >
        <h2
          id="submit-dialog-title"
          className="text-lg font-medium text-neutral-800 dark:text-white/90"
        >
          Submit quiz?
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {answeredCount} of {totalCount} questions answered.
        </p>
        {unanswered > 0 ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-warning-500/30 bg-warning-50 dark:bg-warning-500/15 px-3 py-2 text-sm text-warning-700 dark:text-warning-300">
            <AlertTriangle
              size={16}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <span>
              {unanswered} {unanswered === 1 ? "question is" : "questions are"} unanswered. You
              can&rsquo;t change answers after submitting.
            </span>
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Keep working
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
