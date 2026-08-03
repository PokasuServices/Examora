"use client";

import * as React from "react";
import { X } from "lucide-react";

/** Mobile slide-over for filters — same overlay pattern as the Sidebar's mobile drawer. */
export function FiltersSheet({
  open,
  onClose,
  title = "Filters",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 bg-neutral-900/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-soft-hover"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-900/[0.06] px-4">
          <h2 className="font-heading text-base font-semibold text-neutral-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        <div className="shrink-0 border-t border-neutral-900/[0.06] p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-full items-center justify-center rounded-md bg-primary-600 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}
