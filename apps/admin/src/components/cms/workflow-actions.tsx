"use client";

import * as React from "react";
import type { CmsWorkflowStatus } from "@examora/types";
import { Button } from "@examora/ui";

const STATUS_STYLES: Record<CmsWorkflowStatus, string> = {
  DRAFT: "bg-neutral-200 text-neutral-700",
  IN_REVIEW: "bg-warning-500/10 text-warning-600",
  APPROVED: "bg-primary-500/10 text-primary-600",
  PUBLISHED: "bg-success-500/10 text-success-600",
  ARCHIVED: "bg-neutral-200 text-neutral-500",
};

export function WorkflowStatusBadge({ status }: { status: CmsWorkflowStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

/** Draft -> Review -> Approval -> Publish -> Archive action buttons + scheduling (ADR-0022 §1, §4), shared by every CMS content type. */
export function WorkflowActions({
  status,
  scheduledPublishAt,
  scheduledUnpublishAt,
  onTransition,
  onSchedulePublish,
  onScheduleUnpublish,
}: {
  status: CmsWorkflowStatus;
  scheduledPublishAt: string | null;
  scheduledUnpublishAt: string | null;
  onTransition: (target: CmsWorkflowStatus) => void | Promise<void>;
  onSchedulePublish: (at: string) => void | Promise<void>;
  onScheduleUnpublish: (at: string) => void | Promise<void>;
}) {
  const [scheduleAt, setScheduleAt] = React.useState("");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <WorkflowStatusBadge status={status} />

      {status === "DRAFT" ? (
        <>
          <Button variant="secondary" onClick={() => void onTransition("IN_REVIEW")}>
            Submit for review
          </Button>
          <Button variant="ghost" onClick={() => void onTransition("ARCHIVED")}>
            Discard
          </Button>
        </>
      ) : null}

      {status === "IN_REVIEW" ? (
        <>
          <Button variant="primary" onClick={() => void onTransition("APPROVED")}>
            Approve
          </Button>
          <Button variant="ghost" onClick={() => void onTransition("DRAFT")}>
            Send back to draft
          </Button>
        </>
      ) : null}

      {status === "APPROVED" ? (
        <>
          <Button variant="primary" onClick={() => void onTransition("PUBLISHED")}>
            Publish now
          </Button>
          <Button variant="ghost" onClick={() => void onTransition("DRAFT")}>
            Send back to draft
          </Button>
          {scheduledPublishAt ? (
            <span className="text-xs text-neutral-500">
              Scheduled to publish {new Date(scheduledPublishAt).toLocaleString()}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <input
                type="datetime-local"
                className="rounded border border-neutral-300 px-2 py-1 text-xs"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
              <Button
                variant="secondary"
                disabled={!scheduleAt}
                onClick={() => void onSchedulePublish(new Date(scheduleAt).toISOString())}
              >
                Schedule publish
              </Button>
            </span>
          )}
        </>
      ) : null}

      {status === "PUBLISHED" ? (
        <>
          <Button variant="ghost" onClick={() => void onTransition("ARCHIVED")}>
            Archive now
          </Button>
          {scheduledUnpublishAt ? (
            <span className="text-xs text-neutral-500">
              Scheduled to unpublish {new Date(scheduledUnpublishAt).toLocaleString()}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <input
                type="datetime-local"
                className="rounded border border-neutral-300 px-2 py-1 text-xs"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
              <Button
                variant="secondary"
                disabled={!scheduleAt}
                onClick={() => void onScheduleUnpublish(new Date(scheduleAt).toISOString())}
              >
                Schedule unpublish
              </Button>
            </span>
          )}
        </>
      ) : null}

      {status === "ARCHIVED" ? (
        <Button variant="secondary" onClick={() => void onTransition("DRAFT")}>
          Restore to draft
        </Button>
      ) : null}
    </div>
  );
}
