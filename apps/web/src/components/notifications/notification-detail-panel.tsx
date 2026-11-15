"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, X } from "lucide-react";
import type { NotificationSummary } from "@examora/types";
import { Chip } from "@/components/ui/chip";
import { categoryMeta, resolveDeepLink } from "./types";

/** Slide-over — same overlay/dialog pattern as FiltersSheet, sized for reading a full notification body. */
export function NotificationDetailPanel({
  notification,
  onClose,
}: {
  notification: NotificationSummary | null;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!notification) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [notification, onClose]);

  if (!notification) return null;

  const meta = categoryMeta(notification.category);
  const Icon = meta.icon;
  const deepLink = resolveDeepLink(notification.eventType, notification.data);

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-neutral-900/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Notification detail"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white dark:bg-neutral-900 shadow-soft-hover"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-5">
          <div className="flex items-center gap-2">
            <Icon
              size={16}
              strokeWidth={1.75}
              className="text-primary-600 dark:text-primary-400"
              aria-hidden="true"
            />
            <Chip tone={meta.tone}>{meta.label}</Chip>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notification"
            className="rounded-md p-1.5 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <h2 className="text-lg font-medium text-neutral-800 dark:text-white/90">
            {notification.title}
          </h2>
          <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
            {new Date(notification.createdAt).toLocaleString(undefined, {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {notification.body}
          </p>

          <div className="mt-4 flex items-center gap-1.5 text-xs text-success-700 dark:text-success-300">
            <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />
            {notification.isRead ? "Read" : "Marked read"}
            {notification.readAt
              ? ` · ${new Date(notification.readAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
              : ""}
          </div>

          {deepLink ? (
            <Link
              href={deepLink}
              className="mt-5 flex h-11 items-center justify-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Open
              <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
