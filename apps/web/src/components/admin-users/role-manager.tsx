"use client";

import * as React from "react";
import { ROLE_NAMES, type RoleName } from "@examora/types";
import { Chip } from "@/components/ui/chip";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { roleLabel } from "@/components/settings/format";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** AssignRolesDto replaces the full role set in one call — this stages the desired full set, then confirms before submitting. */
export function RoleManager({
  currentRoles,
  mutationStatus,
  mutationError,
  onSave,
}: {
  currentRoles: RoleName[];
  mutationStatus: "idle" | "submitting" | "error";
  mutationError: string | null;
  onSave: (roles: RoleName[]) => Promise<boolean>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [selected, setSelected] = React.useState<RoleName[]>(currentRoles);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setSelected(currentRoles);
  }, [currentRoles]);

  function toggleRole(role: RoleName): void {
    setSaved(false);
    setSelected((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...currentRoles].sort());

  async function confirmSave(): Promise<void> {
    const ok = await onSave(selected);
    if (ok) {
      setConfirmOpen(false);
      setEditing(false);
      setSaved(true);
    }
  }

  if (!editing) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          {currentRoles.length > 0 ? (
            currentRoles.map((role) => (
              <Chip key={role} tone="primary">
                {roleLabel(role)}
              </Chip>
            ))
          ) : (
            <p className="text-sm text-neutral-500">No roles assigned.</p>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            Manage roles
          </button>
          {saved ? <AutosaveIndicator status="saved" /> : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      <fieldset>
        <legend className="sr-only">Assign roles</legend>
        <div className="flex flex-col gap-2">
          {ROLE_NAMES.map((role) => (
            <label key={role} className="flex items-center gap-2.5 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={selected.includes(role)}
                onChange={() => toggleRole(role)}
                className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              />
              {roleLabel(role)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || selected.length === 0}
          onClick={() => setConfirmOpen(true)}
          className="flex h-9 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-50"
        >
          Save changes
        </button>
        <button
          type="button"
          onClick={() => {
            setSelected(currentRoles);
            setEditing(false);
          }}
          className="text-sm font-medium text-neutral-600 hover:underline"
        >
          Cancel
        </button>
      </div>
      {selected.length === 0 ? (
        <p className="mt-2 text-xs text-danger-600">A user must have at least one role.</p>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Update roles?"
        message={
          <>
            Change this user&rsquo;s roles from{" "}
            <span className="font-medium text-neutral-800">
              {currentRoles.map(roleLabel).join(", ") || "none"}
            </span>{" "}
            to{" "}
            <span className="font-medium text-neutral-800">
              {selected.map(roleLabel).join(", ")}
            </span>
            ?
          </>
        }
        confirmLabel="Update roles"
        submitting={mutationStatus === "submitting"}
        error={mutationError}
        onConfirm={() => void confirmSave()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
