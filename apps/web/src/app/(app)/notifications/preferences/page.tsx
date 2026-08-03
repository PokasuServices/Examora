"use client";

import * as React from "react";
import Link from "next/link";
import { ApiError } from "@examora/auth-client";
import { Button, FieldError, Input, Label } from "@examora/ui";
import type { NotificationDigestMode, NotificationPreferenceDto } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { useNotificationsApi, type WebPushSubscriptionSummary } from "@/lib/notifications-api";
import {
  isWebPushSupported,
  subscribeToWebPush,
  unsubscribeFromWebPushInBrowser,
} from "@/lib/web-push";

function minuteToTime(minute: number | null): string {
  if (minute === null) return "";
  const h = Math.floor(minute / 60)
    .toString()
    .padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMinute(time: string): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function PreferencesForm() {
  const api = useNotificationsApi();
  const [prefs, setPrefs] = React.useState<NotificationPreferenceDto | null>(null);
  const [mutedInput, setMutedInput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    api
      .getPreferences()
      .then(setPrefs)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addMuted(): void {
    const category = mutedInput.trim();
    if (!category || !prefs || prefs.mutedCategories.includes(category)) {
      setMutedInput("");
      return;
    }
    setPrefs({ ...prefs, mutedCategories: [...prefs.mutedCategories, category] });
    setMutedInput("");
  }

  function removeMuted(category: string): void {
    if (!prefs) return;
    setPrefs({ ...prefs, mutedCategories: prefs.mutedCategories.filter((c) => c !== category) });
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!prefs) return;
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      const updated = await api.updatePreferences(prefs);
      setPrefs(updated);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your preferences.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!prefs) {
    return <p className="text-sm text-neutral-500">Loading preferences…</p>;
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Channels &amp; digest</h2>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-5" noValidate>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["emailEnabled", "Email"],
              ["smsEnabled", "SMS"],
              ["whatsappEnabled", "WhatsApp"],
              ["webPushEnabled", "Browser push"],
              ["inAppEnabled", "In-app"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="digestMode">Digest mode</Label>
          <select
            id="digestMode"
            value={prefs.digestMode}
            onChange={(e) =>
              setPrefs({ ...prefs, digestMode: e.target.value as NotificationDigestMode })
            }
            className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            <option value="INSTANT">Instant</option>
            <option value="DAILY">Daily digest</option>
            <option value="WEEKLY">Weekly digest</option>
          </select>
        </div>

        <div>
          <Label>Muted categories</Label>
          <p className="mt-1 text-xs text-neutral-500">
            Non-critical notifications in these categories won&apos;t be sent by email/SMS/WhatsApp/
            browser push — they still appear in your Notification Center.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {prefs.mutedCategories.map((category) => (
              <span
                key={category}
                className="flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700"
              >
                {category}
                <button
                  type="button"
                  onClick={() => removeMuted(category)}
                  aria-label={`Unmute ${category}`}
                  className="text-neutral-400 hover:text-neutral-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={mutedInput}
              placeholder="e.g. community"
              onChange={(e) => setMutedInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMuted();
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={addMuted}>
              Add
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dndStart">Quiet hours start</Label>
            <Input
              id="dndStart"
              type="time"
              value={minuteToTime(prefs.dndStartMinute)}
              onChange={(e) => setPrefs({ ...prefs, dndStartMinute: timeToMinute(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dndEnd">Quiet hours end</Label>
            <Input
              id="dndEnd"
              type="time"
              value={minuteToTime(prefs.dndEndMinute)}
              onChange={(e) => setPrefs({ ...prefs, dndEndMinute: timeToMinute(e.target.value) })}
            />
          </div>
        </div>
        <p className="-mt-3 text-xs text-neutral-500">
          Non-critical channel sends are held during quiet hours; security and account alerts always
          go through.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="language">Language</Label>
            <Input
              id="language"
              value={prefs.language}
              onChange={(e) => setPrefs({ ...prefs, language: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="timezone">Time zone</Label>
            <Input
              id="timezone"
              value={prefs.timezone}
              placeholder="e.g. Asia/Kolkata"
              onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
            />
          </div>
        </div>

        <FieldError>{error}</FieldError>
        {success ? <p className="text-sm text-success-600">Preferences saved.</p> : null}
        <div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function WebPushSection() {
  const api = useNotificationsApi();
  const [subscriptions, setSubscriptions] = React.useState<WebPushSubscriptionSummary[] | null>(
    null,
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const supported = React.useMemo(() => isWebPushSupported(), []);

  const load = React.useCallback(() => {
    api
      .listWebPushSubscriptions()
      .then(setSubscriptions)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function enable(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const subscription = await subscribeToWebPush();
      await api.subscribeWebPush(subscription);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable browser notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(endpoint: string): Promise<void> {
    setBusy(true);
    try {
      await api.unsubscribeWebPush(endpoint);
      await unsubscribeFromWebPushInBrowser().catch(() => undefined);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Browser push notifications</h2>
      {!supported ? (
        <p className="mt-2 text-sm text-neutral-500">
          Browser push isn&apos;t available — your browser doesn&apos;t support it, or it
          hasn&apos;t been configured on this deployment yet.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-neutral-600">
            Get an alert on this device even when Examora isn&apos;t open.
          </p>
          <div className="mt-3">
            <Button variant="secondary" disabled={busy} onClick={() => void enable()}>
              {busy ? "Working…" : "Enable on this device"}
            </Button>
          </div>
          <FieldError>{error}</FieldError>
        </>
      )}

      {subscriptions && subscriptions.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {subscriptions.map((sub) => (
            <li
              key={sub.id}
              className="flex items-center justify-between rounded-md border border-neutral-100 p-3 text-sm"
            >
              <span className="truncate text-neutral-600">
                Device registered {new Date(sub.createdAt).toLocaleDateString()}
              </span>
              <Button variant="ghost" disabled={busy} onClick={() => void disable(sub.endpoint)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function PreferencesContent() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-heading">Notification preferences</h1>
        <Link href="/notifications" className="text-sm text-primary-600 hover:underline">
          ← Back to notifications
        </Link>
      </header>
      <PreferencesForm />
      <WebPushSection />
    </main>
  );
}

export default function NotificationPreferencesPage() {
  return (
    <RequireAuth>
      <PreferencesContent />
    </RequireAuth>
  );
}
