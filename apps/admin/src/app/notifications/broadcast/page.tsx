"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { NotificationChannel } from "@examora/types";
import { NOTIFICATION_CHANNELS } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { NotificationsNav } from "@/components/notifications-nav";
import { RequirePermission } from "@/components/require-permission";
import { useNotificationsAdminApi } from "@/lib/notifications-api";

const BROADCASTABLE_CHANNELS = NOTIFICATION_CHANNELS.filter((c) => c !== "MOBILE_PUSH");

function BroadcastContent() {
  const api = useNotificationsAdminApi();
  const [userIdsInput, setUserIdsInput] = React.useState("");
  const [eventType, setEventType] = React.useState("platform.broadcast_announcement");
  const [category, setCategory] = React.useState("platform");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [channels, setChannels] = React.useState<NotificationChannel[]>(["IN_APP"]);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ count: number } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function toggleChannel(channel: NotificationChannel): void {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );
  }

  async function send(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setResult(null);

    const userIds = userIdsInput
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (userIds.length === 0) {
      setError("Enter at least one user id");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.broadcast({
        userIds,
        eventType,
        category,
        title,
        body,
        channels: channels.filter((c) => c !== "IN_APP"),
      });
      setResult(res);
      setTitle("");
      setBody("");
      setUserIdsInput("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the broadcast");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <NotificationsNav />
      <h1 className="text-heading">Broadcast composer</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Sends one notification to every listed user. Every recipient always gets it in their
        Notification Center; additional channels are subject to each user&apos;s own preferences.
      </p>

      <form
        onSubmit={send}
        className="mt-6 flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="userIds">Recipient user ids (comma or newline separated)</Label>
          <textarea
            id="userIds"
            value={userIdsInput}
            onChange={(e) => setUserIdsInput(e.target.value)}
            rows={4}
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder={
              "11111111-1111-4111-8111-111111111111\n22222222-2222-4222-8222-222222222222"
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eventType">Event type</Label>
            <Input
              id="eventType"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="body">Body</Label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <Label>Channels</Label>
          <div className="mt-2 flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-sm text-neutral-500">
              <input type="checkbox" checked disabled />
              IN_APP (always)
            </label>
            {BROADCASTABLE_CHANNELS.filter((c) => c !== "IN_APP").map((channel) => (
              <label key={channel} className="flex items-center gap-1.5 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={channels.includes(channel)}
                  onChange={() => toggleChannel(channel)}
                />
                {channel}
              </label>
            ))}
          </div>
        </div>

        <FieldError>{error}</FieldError>
        {result ? (
          <p className="text-sm text-success-600">Sent to {result.count} recipient(s).</p>
        ) : null}
        <div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send broadcast"}
          </Button>
        </div>
      </form>
    </main>
  );
}

export default function BroadcastPage() {
  return (
    <RequirePermission permission="notification:manage">
      <BroadcastContent />
    </RequirePermission>
  );
}
