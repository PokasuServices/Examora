"use client";

import * as React from "react";
import { useAuth } from "@examora/auth-client";
import type { CmsWorkflowStatus } from "@examora/types";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { statusLabel } from "@/components/orders/format";
import { cmsStatusTone, transitionActionLabel, validCmsStatusTransitions } from "./format";

export function WorkflowActions({
  status,
  scheduledPublishAt,
  scheduledUnpublishAt,
  publishedAt,
  mutationStatus,
  mutationError,
  onTransition,
  onSchedulePublish,
  onScheduleUnpublish,
}: {
  status: CmsWorkflowStatus;
  scheduledPublishAt: string | null;
  scheduledUnpublishAt: string | null;
  publishedAt: string | null;
  mutationStatus: "idle" | "submitting" | "error";
  mutationError: string | null;
  onTransition: (target: CmsWorkflowStatus) => Promise<boolean>;
  onSchedulePublish: (at: string) => Promise<boolean>;
  onScheduleUnpublish: (at: string) => Promise<boolean>;
}) {
  const { user } = useAuth();
  const canPublish = user?.permissions.includes("cms:publish") ?? false;
  const [pendingTransition, setPendingTransition] = React.useState<CmsWorkflowStatus | null>(null);
  const [scheduling, setScheduling] = React.useState<"publish" | "unpublish" | null>(null);
  const [scheduleAt, setScheduleAt] = React.useState("");

  async function confirmTransition(): Promise<void> {
    if (!pendingTransition) return;
    const ok = await onTransition(pendingTransition);
    if (ok) setPendingTransition(null);
  }

  async function submitSchedule(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!scheduleAt) return;
    const iso = new Date(scheduleAt).toISOString();
    const ok =
      scheduling === "publish" ? await onSchedulePublish(iso) : await onScheduleUnpublish(iso);
    if (ok) {
      setScheduling(null);
      setScheduleAt("");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={cmsStatusTone(status)}>{statusLabel(status)}</Chip>
        {canPublish
          ? validCmsStatusTransitions(status).map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => setPendingTransition(target)}
                className="flex h-8 items-center rounded-md border border-neutral-200 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                {transitionActionLabel(target)}
              </button>
            ))
          : null}
        {canPublish && status === "APPROVED" ? (
          <button
            type="button"
            onClick={() => setScheduling("publish")}
            className="flex h-8 items-center rounded-md border border-neutral-200 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Schedule publish
          </button>
        ) : null}
        {canPublish && status === "PUBLISHED" ? (
          <button
            type="button"
            onClick={() => setScheduling("unpublish")}
            className="flex h-8 items-center rounded-md border border-neutral-200 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Schedule unpublish
          </button>
        ) : null}
      </div>

      {scheduledPublishAt ? (
        <p className="text-xs text-neutral-500">
          Scheduled to publish {new Date(scheduledPublishAt).toLocaleString()} — call
          &ldquo;Schedule publish&rdquo; again with a new time to reschedule.
        </p>
      ) : null}
      {scheduledUnpublishAt ? (
        <p className="text-xs text-neutral-500">
          Scheduled to unpublish {new Date(scheduledUnpublishAt).toLocaleString()} — call
          &ldquo;Schedule unpublish&rdquo; again with a new time to reschedule.
        </p>
      ) : null}
      {publishedAt ? (
        <p className="text-xs text-neutral-400">
          Published {new Date(publishedAt).toLocaleString()}
        </p>
      ) : null}

      {scheduling ? (
        <form onSubmit={(e) => void submitSchedule(e)} className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cms-schedule-at" className="text-xs font-medium text-neutral-500">
              {scheduling === "publish" ? "Publish at" : "Unpublish at"}
            </label>
            <input
              id="cms-schedule-at"
              type="datetime-local"
              required
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="h-9 rounded-md border border-neutral-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            disabled={mutationStatus === "submitting"}
            className="flex h-9 items-center rounded-md bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 disabled:pointer-events-none disabled:opacity-60"
          >
            {mutationStatus === "submitting" ? "Saving…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setScheduling(null)}
            className="text-xs font-medium text-neutral-600 hover:underline"
          >
            Cancel
          </button>
        </form>
      ) : null}

      <ConfirmDialog
        open={pendingTransition !== null}
        title="Change status?"
        message={
          pendingTransition ? (
            <>
              Change status from{" "}
              <span className="font-medium text-neutral-800">{statusLabel(status)}</span> to{" "}
              <span className="font-medium text-neutral-800">{statusLabel(pendingTransition)}</span>
              ?
            </>
          ) : null
        }
        confirmLabel={pendingTransition ? transitionActionLabel(pendingTransition) : "Confirm"}
        submitting={mutationStatus === "submitting"}
        error={mutationError}
        onConfirm={() => void confirmTransition()}
        onCancel={() => setPendingTransition(null)}
      />
    </div>
  );
}
