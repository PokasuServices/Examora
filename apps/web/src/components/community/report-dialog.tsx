"use client";

import * as React from "react";
import { X } from "lucide-react";

/** Accessible replacement for window.prompt/alert — same overlay pattern as FiltersSheet, centered instead of slide-over. */
export function ReportDialog({
  open,
  targetLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  targetLabel: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setReason("");
    setDone(false);
    textareaRef.current?.focus();
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        className="relative w-full max-w-md rounded-card bg-white p-6 shadow-soft-hover"
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="report-dialog-title"
            className="font-heading text-lg font-semibold text-neutral-900"
          >
            Report this {targetLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {done ? (
          <div className="mt-4">
            <p className="text-sm text-neutral-600">
              Thanks — this has been sent to the moderation team for review.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 flex h-10 w-full items-center justify-center rounded-md bg-primary-600 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-4">
            <label
              htmlFor="report-reason"
              className="mb-1.5 block text-xs font-medium text-neutral-500"
            >
              Why are you reporting this {targetLabel}?
            </label>
            <textarea
              id="report-reason"
              ref={textareaRef}
              required
              minLength={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell the moderation team what's wrong…"
              className="min-h-24 w-full rounded-md border border-neutral-200 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !reason.trim()}
                className="flex h-10 items-center justify-center rounded-md bg-danger-600 px-4 text-sm font-medium text-white hover:bg-danger-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Submit report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
