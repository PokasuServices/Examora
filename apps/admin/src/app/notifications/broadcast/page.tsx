"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { NotificationChannel } from "@examora/types";
import { NOTIFICATION_CHANNELS } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { useNotificationsAdminApi } from "@/lib/notifications-api";

const BROADCASTABLE_CHANNELS = NOTIFICATION_CHANNELS.filter((c) => c !== "MOBILE_PUSH");

const TEXTAREA_CLASS =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 " +
  "placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-primary-600 focus-visible:ring-offset-1";

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
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  function toggleChannel(channel: NotificationChannel): void {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );
  }

  const recipientIds = userIdsInput
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  function reviewSend(event: React.FormEvent): void {
    event.preventDefault();
    setError(null);
    setResult(null);
    if (recipientIds.length === 0) {
      setError("Enter at least one user id");
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmSend(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.broadcast({
        userIds: recipientIds,
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
      setConfirmOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the broadcast");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Broadcast composer"
        subtitle="Sends one notification to every listed user. Every recipient always gets it in their Notification Center; additional channels are subject to each user's own preferences."
      />

      <Card>
        <form onSubmit={reviewSend} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="userIds">Recipient user ids (comma or newline separated)</Label>
            <textarea
              id="userIds"
              value={userIdsInput}
              onChange={(e) => setUserIdsInput(e.target.value)}
              rows={4}
              required
              className={TEXTAREA_CLASS}
              placeholder={
                "11111111-1111-4111-8111-111111111111\n22222222-2222-4222-8222-222222222222"
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
              className={TEXTAREA_CLASS}
            />
          </div>

          <div>
            <Label>Channels</Label>
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 text-sm text-neutral-500">
                <input
                  type="checkbox"
                  checked
                  disabled
                  className="h-4 w-4 rounded border-neutral-300"
                />
                IN_APP (always)
              </label>
              {BROADCASTABLE_CHANNELS.filter((c) => c !== "IN_APP").map((channel) => (
                <label key={channel} className="flex items-center gap-1.5 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={channels.includes(channel)}
                    onChange={() => toggleChannel(channel)}
                    className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Send broadcast?"
        message={
          <>
            Send this notification to{" "}
            <span className="font-medium text-neutral-800">
              {recipientIds.length} recipient{recipientIds.length === 1 ? "" : "s"}
            </span>
            ? Every recipient always gets it in their Notification Center; additional channels are
            subject to each user&apos;s own preferences.
          </>
        }
        confirmLabel="Send broadcast"
        submitting={submitting}
        error={error}
        onConfirm={() => void confirmSend()}
        onCancel={() => setConfirmOpen(false)}
      />
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
