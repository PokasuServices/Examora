"use client";

import * as React from "react";
import { USER_STATUSES, type UserStatus } from "@examora/types";
import { Chip } from "@/components/ui/chip";
import { SelectField } from "@/components/ui/select-field";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { statusLabel } from "@/components/orders/format";
import { userStatusTone } from "./format";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const STATUS_OPTIONS = USER_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }));

export function StatusManager({
  currentStatus,
  mutationStatus,
  mutationError,
  onChange,
}: {
  currentStatus: UserStatus;
  mutationStatus: "idle" | "submitting" | "error";
  mutationError: string | null;
  onChange: (status: UserStatus) => Promise<boolean>;
}) {
  const [draft, setDraft] = React.useState<UserStatus>(currentStatus);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setDraft(currentStatus);
  }, [currentStatus]);

  async function confirmChange(): Promise<void> {
    const ok = await onChange(draft);
    if (ok) {
      setConfirmOpen(false);
      setSaved(true);
    }
  }

  return (
    <div>
      <Chip tone={userStatusTone(currentStatus)}>{statusLabel(currentStatus)}</Chip>

      <div className="mt-4 flex items-end gap-3">
        <div className="w-56">
          <SelectField
            id="user-status-select"
            label="Change status to"
            value={draft}
            options={STATUS_OPTIONS}
            onChange={(v) => {
              setDraft(v as UserStatus);
              setSaved(false);
            }}
          />
        </div>
        <button
          type="button"
          disabled={draft === currentStatus}
          onClick={() => setConfirmOpen(true)}
          className="flex h-10 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-50"
        >
          Update status
        </button>
        {saved ? <AutosaveIndicator status="saved" /> : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Change account status?"
        message={
          <>
            Change status from{" "}
            <span className="font-medium text-neutral-800">{statusLabel(currentStatus)}</span> to{" "}
            <span className="font-medium text-neutral-800">{statusLabel(draft)}</span>?
            {draft === "SUSPENDED" || draft === "ARCHIVED" ? (
              <span className="mt-2 block text-danger-600">
                This will immediately revoke the user&rsquo;s active sessions.
              </span>
            ) : null}
          </>
        }
        confirmLabel="Update status"
        tone={draft === "SUSPENDED" || draft === "ARCHIVED" ? "danger" : "primary"}
        submitting={mutationStatus === "submitting"}
        error={mutationError}
        onConfirm={() => void confirmChange()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
