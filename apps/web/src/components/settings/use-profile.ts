"use client";

import * as React from "react";
import { ApiError, useAuth } from "@examora/auth-client";
import type { UserProfile } from "@examora/types";
import { useSettingsApi, type UpdateProfilePayload } from "@/lib/settings-api";

type Status = "loading" | "ready" | "error";
export type SaveStatus = "idle" | "saving" | "saved" | "error";

function toForm(profile: UserProfile): UpdateProfilePayload {
  return {
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    phone: profile.phone ?? "",
    dateOfBirth: profile.dateOfBirth ?? "",
    guardianName: profile.guardianName ?? "",
    guardianEmail: profile.guardianEmail ?? "",
  };
}

/** Loads /users/me and tracks an editable draft against it — dirty is true the moment any field diverges from the last-saved profile. */
export function useProfile() {
  const api = useSettingsApi();
  const { refetchUser } = useAuth();
  const [status, setStatus] = React.useState<Status>("loading");
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [form, setForm] = React.useState<UpdateProfilePayload>({});
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .getProfile()
      .then((p) => {
        setProfile(p);
        setForm(toForm(p));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const dirty = React.useMemo(() => {
    if (!profile) return false;
    const baseline = toForm(profile);
    return (Object.keys(baseline) as (keyof UpdateProfilePayload)[]).some(
      (key) => (form[key] ?? "") !== (baseline[key] ?? ""),
    );
  }, [form, profile]);

  function patch(update: Partial<UpdateProfilePayload>): void {
    setForm((prev) => ({ ...prev, ...update }));
    setSaveStatus("idle");
  }

  async function save(): Promise<void> {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const updated = await api.updateProfile({
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        phone: form.phone || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        guardianName: form.guardianName || undefined,
        guardianEmail: form.guardianEmail || undefined,
      });
      setProfile(updated);
      setForm(toForm(updated));
      setSaveStatus("saved");
      await refetchUser().catch(() => undefined);
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof ApiError ? err.message : "Could not save your profile.");
    }
  }

  return { status, profile, form, patch, dirty, saveStatus, saveError, save, retry: load };
}
