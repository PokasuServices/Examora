"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { useAuth } from "@examora/auth-client";
import type { ContentStatus, PermissionCode, ReviewableContentType } from "@examora/types";
import { Button } from "@examora/ui";
import { useDeskApi } from "@/lib/desk-api";

/**
 * Renders the valid status-transition buttons for a content node, mirroring the
 * server-side rules in content-status.util.ts (ADR-0012). With `permission`,
 * someone who lacks it (a mentor without content:publish) instead gets "Send to
 * admin to publish" for a draft (when `review` names the record), or a note that
 * an administrator publishes it.
 */
export function StatusActions({
  status,
  onChange,
  disabled,
  permission,
  review,
}: {
  status: ContentStatus;
  onChange: (next: ContentStatus) => void;
  disabled?: boolean;
  permission?: PermissionCode;
  review?: { type: ReviewableContentType; id: string };
}) {
  const { user } = useAuth();
  const api = useDeskApi();
  const [sent, setSent] = React.useState<"idle" | "sending" | "sent" | string>("idle");

  if (permission && !user?.permissions.includes(permission)) {
    if (review && status === "DRAFT") {
      if (sent === "sent") {
        return (
          <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300">
            Waiting for the admin to publish
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={sent === "sending"}
            onClick={async () => {
              setSent("sending");
              try {
                await api.requestPublish(review.type, review.id);
                setSent("sent");
              } catch (err) {
                const msg = err instanceof Error ? err.message : "Couldn't send";
                setSent(/already waiting/i.test(msg) ? "sent" : msg);
              }
            }}
          >
            <Send size={13} aria-hidden="true" /> Send to admin to publish
          </Button>
          {sent !== "idle" && sent !== "sending" ? (
            <span role="alert" className="text-xs text-rose-600">
              {sent}
            </span>
          ) : null}
        </span>
      );
    }
    return (
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        {status === "PUBLISHED"
          ? "Live · edits go to the admin for review"
          : "An admin publishes this"}
      </span>
    );
  }

  const targets: { label: string; next: ContentStatus }[] = [];
  if (status === "DRAFT") {
    targets.push({ label: "Publish", next: "PUBLISHED" }, { label: "Archive", next: "ARCHIVED" });
  } else if (status === "PUBLISHED") {
    targets.push({ label: "Unpublish", next: "DRAFT" }, { label: "Archive", next: "ARCHIVED" });
  } else {
    targets.push({ label: "Restore to draft", next: "DRAFT" });
  }

  return (
    <div className="flex gap-2">
      {targets.map((t) => (
        <Button key={t.next} variant="ghost" disabled={disabled} onClick={() => onChange(t.next)}>
          {t.label}
        </Button>
      ))}
    </div>
  );
}
