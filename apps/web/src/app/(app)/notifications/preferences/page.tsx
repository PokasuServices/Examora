"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, Moon, Smartphone, X } from "lucide-react";
import type { NotificationDigestMode, NotificationPreferenceDto } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useNotificationsApi, type WebPushSubscriptionSummary } from "@/lib/notifications-api";
import {
  isWebPushSupported,
  subscribeToWebPush,
  unsubscribeFromWebPushInBrowser,
} from "@/lib/web-push";

const CHANNELS: {
  key: keyof NotificationPreferenceDto & string;
  label: string;
  description: string;
}[] = [
  { key: "emailEnabled", label: "Email", description: "Digest and important updates by email." },
  { key: "smsEnabled", label: "SMS", description: "Text messages for time-sensitive alerts." },
  { key: "whatsappEnabled", label: "WhatsApp", description: "Updates delivered via WhatsApp." },
  {
    key: "webPushEnabled",
    label: "Browser push",
    description: "Alerts on this device, even when Examora isn't open.",
  },
  { key: "inAppEnabled", label: "In-app", description: "Show up in your Notification Center." },
];

const DIGEST_OPTIONS: { value: NotificationDigestMode; label: string }[] = [
  { value: "INSTANT", label: "Instant" },
  { value: "DAILY", label: "Daily digest" },
  { value: "WEEKLY", label: "Weekly digest" },
];

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

function ChannelsCard({
  prefs,
  onChange,
}: {
  prefs: NotificationPreferenceDto;
  onChange: (patch: Partial<NotificationPreferenceDto>) => void;
}) {
  return (
    <Card>
      <h2 className="font-heading text-base font-semibold text-neutral-900">Channels</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Choose where non-critical updates reach you. Security and account alerts always go through
        by email, regardless of these settings.
      </p>
      <ul className="mt-4 flex flex-col divide-y divide-neutral-100">
        {CHANNELS.map((channel) => (
          <li key={channel.key} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-800">{channel.label}</p>
              <p className="text-xs text-neutral-500">{channel.description}</p>
            </div>
            <Switch
              label={channel.label}
              checked={Boolean(prefs[channel.key])}
              onChange={(checked) => onChange({ [channel.key]: checked })}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DigestCard({
  prefs,
  onChange,
}: {
  prefs: NotificationPreferenceDto;
  onChange: (patch: Partial<NotificationPreferenceDto>) => void;
}) {
  return (
    <Card>
      <h2 className="font-heading text-base font-semibold text-neutral-900">Digest</h2>
      <p className="mt-1 text-sm text-neutral-500">How often batched updates should arrive.</p>
      <div className="mt-4">
        <SegmentedControl
          aria-label="Digest mode"
          value={prefs.digestMode}
          onChange={(v) => onChange({ digestMode: v })}
          options={DIGEST_OPTIONS}
        />
      </div>
    </Card>
  );
}

function MutedCategoriesCard({
  prefs,
  onChange,
}: {
  prefs: NotificationPreferenceDto;
  onChange: (patch: Partial<NotificationPreferenceDto>) => void;
}) {
  const [input, setInput] = React.useState("");

  function addMuted() {
    const category = input.trim().toLowerCase();
    if (!category || prefs.mutedCategories.includes(category)) {
      setInput("");
      return;
    }
    onChange({ mutedCategories: [...prefs.mutedCategories, category] });
    setInput("");
  }

  function removeMuted(category: string) {
    onChange({ mutedCategories: prefs.mutedCategories.filter((c) => c !== category) });
  }

  return (
    <Card>
      <h2 className="font-heading text-base font-semibold text-neutral-900">Muted categories</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Non-critical notifications in these categories won&rsquo;t be sent by email, SMS, WhatsApp,
        or browser push — they still appear in your Notification Center. Try{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">community</code> or{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">learning</code>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {prefs.mutedCategories.length === 0 ? (
          <p className="text-xs text-neutral-400">Nothing muted.</p>
        ) : (
          prefs.mutedCategories.map((category) => (
            <Chip key={category} tone="neutral" className="gap-1.5">
              {category}
              <button
                type="button"
                onClick={() => removeMuted(category)}
                aria-label={`Unmute ${category}`}
                className="text-neutral-400 hover:text-neutral-700"
              >
                <X size={11} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </Chip>
          ))
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <label htmlFor="mute-category-input" className="sr-only">
          Category to mute
        </label>
        <input
          id="mute-category-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addMuted();
            }
          }}
          placeholder="e.g. community"
          className="h-10 flex-1 rounded-md border border-neutral-200 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        />
        <button
          type="button"
          onClick={addMuted}
          className="flex h-10 items-center rounded-md border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Add
        </button>
      </div>
    </Card>
  );
}

function QuietHoursCard({
  prefs,
  onChange,
}: {
  prefs: NotificationPreferenceDto;
  onChange: (patch: Partial<NotificationPreferenceDto>) => void;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Moon size={16} strokeWidth={1.75} className="text-primary-600" aria-hidden="true" />
        <h2 className="font-heading text-base font-semibold text-neutral-900">Quiet hours</h2>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Non-critical channel sends are held during this window; security and account alerts always
        go through.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="dnd-start" className="mb-1.5 block text-xs font-medium text-neutral-500">
            Starts
          </label>
          <input
            id="dnd-start"
            type="time"
            value={minuteToTime(prefs.dndStartMinute)}
            onChange={(e) => onChange({ dndStartMinute: timeToMinute(e.target.value) })}
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          />
        </div>
        <div>
          <label htmlFor="dnd-end" className="mb-1.5 block text-xs font-medium text-neutral-500">
            Ends
          </label>
          <input
            id="dnd-end"
            type="time"
            value={minuteToTime(prefs.dndEndMinute)}
            onChange={(e) => onChange({ dndEndMinute: timeToMinute(e.target.value) })}
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          />
        </div>
      </div>
    </Card>
  );
}

function LocaleCard({
  prefs,
  onChange,
}: {
  prefs: NotificationPreferenceDto;
  onChange: (patch: Partial<NotificationPreferenceDto>) => void;
}) {
  return (
    <Card>
      <h2 className="font-heading text-base font-semibold text-neutral-900">
        Language &amp; time zone
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="pref-language"
            className="mb-1.5 block text-xs font-medium text-neutral-500"
          >
            Language
          </label>
          <input
            id="pref-language"
            value={prefs.language}
            onChange={(e) => onChange({ language: e.target.value })}
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          />
        </div>
        <div>
          <label
            htmlFor="pref-timezone"
            className="mb-1.5 block text-xs font-medium text-neutral-500"
          >
            Time zone
          </label>
          <input
            id="pref-timezone"
            value={prefs.timezone}
            placeholder="e.g. Asia/Kolkata"
            onChange={(e) => onChange({ timezone: e.target.value })}
            className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          />
        </div>
      </div>
    </Card>
  );
}

function WebPushCard() {
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
    <Card>
      <div className="flex items-center gap-2">
        <Smartphone size={16} strokeWidth={1.75} className="text-primary-600" aria-hidden="true" />
        <h2 className="font-heading text-base font-semibold text-neutral-900">Devices</h2>
      </div>
      {!supported ? (
        <p className="mt-2 text-sm text-neutral-500">
          Browser push isn&rsquo;t available — your browser doesn&rsquo;t support it, or it
          hasn&rsquo;t been configured on this deployment.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-neutral-600">
            Register this browser to receive push notifications even when Examora isn&rsquo;t open.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void enable()}
            className="mt-3 flex h-10 items-center rounded-md border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
          >
            {busy ? "Working…" : "Enable on this device"}
          </button>
          {error ? <p className="mt-2 text-sm text-danger-600">{error}</p> : null}
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
                Registered {new Date(sub.createdAt).toLocaleDateString()}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void disable(sub.endpoint)}
                className="text-danger-600 hover:underline disabled:pointer-events-none disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function PreferencesContent() {
  const api = useNotificationsApi();
  const [prefs, setPrefs] = React.useState<NotificationPreferenceDto | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .getPreferences()
      .then(setPrefs)
      .catch(() => setError("Couldn't load your preferences."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patch(update: Partial<NotificationPreferenceDto>): void {
    setPrefs((prev) => (prev ? { ...prev, ...update } : prev));
    setDirty(true);
    setSaved(false);
  }

  async function handleSave(): Promise<void> {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updatePreferences(prefs);
      setPrefs(updated);
      setDirty(false);
      setSaved(true);
    } catch {
      setError("Could not save your preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/notifications"
            className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
          >
            <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
            Notifications
          </Link>
          <h1 className="mt-1 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            Preferences
          </h1>
        </div>
      </div>

      {!prefs ? (
        <p className="text-sm text-neutral-500">{error ?? "Loading preferences…"}</p>
      ) : (
        <>
          <ChannelsCard prefs={prefs} onChange={patch} />
          <DigestCard prefs={prefs} onChange={patch} />
          <MutedCategoriesCard prefs={prefs} onChange={patch} />
          <QuietHoursCard prefs={prefs} onChange={patch} />
          <LocaleCard prefs={prefs} onChange={patch} />
          <WebPushCard />

          <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-card border border-neutral-900/[0.06] bg-white/95 p-4 shadow-soft-hover backdrop-blur">
            {error ? <p className="mr-auto text-sm text-danger-600">{error}</p> : null}
            {saved && !dirty ? (
              <p className="mr-auto flex items-center gap-1 text-sm text-success-700">
                <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                Saved
              </p>
            ) : null}
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void handleSave()}
              className="flex h-11 items-center justify-center rounded-md bg-primary-600 px-6 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </>
      )}
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
