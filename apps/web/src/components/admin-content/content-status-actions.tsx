"use client";

import * as React from "react";
import { useAuth } from "@examora/auth-client";
import type { ContentStatus } from "@examora/types";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { statusLabel } from "@/components/orders/format";
import { contentStatusTone, validContentStatusTransitions } from "./format";

/** Shared by Course/Subject/Topic/Module/Lesson — all use the exact same ContentStatus state machine. */
export function ContentStatusActions({
  status,
  mutationStatus,
  mutationError,
  onChange,
  entityLabel,
}: {
  status: ContentStatus;
  mutationStatus: "idle" | "submitting" | "error";
  mutationError: string | null;
  onChange: (status: ContentStatus) => Promise<boolean>;
  entityLabel: string;
}) {
  const { user } = useAuth();
  const canPublish = user?.permissions.includes("content:publish") ?? false;
  const [pending, setPending] = React.useState<ContentStatus | null>(null);

  async function confirm(): Promise<void> {
    if (!pending) return;
    const ok = await onChange(pending);
    if (ok) setPending(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip tone={contentStatusTone(status)}>{statusLabel(status)}</Chip>
      {canPublish
        ? validContentStatusTransitions(status).map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => setPending(target)}
              className="flex h-8 items-center rounded-md border border-neutral-200 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {statusLabel(target)}
            </button>
          ))
        : null}

      <ConfirmDialog
        open={pending !== null}
        title={`Change ${entityLabel} status?`}
        message={
          pending ? (
            <>
              Change status from{" "}
              <span className="font-medium text-neutral-800">{statusLabel(status)}</span> to{" "}
              <span className="font-medium text-neutral-800">{statusLabel(pending)}</span>?
            </>
          ) : null
        }
        confirmLabel={pending ? statusLabel(pending) : "Confirm"}
        submitting={mutationStatus === "submitting"}
        error={mutationError}
        onConfirm={() => void confirm()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
