"use client";

import * as React from "react";
import Link from "next/link";
import { ApiError } from "@examora/auth-client";
import type { NotificationChannel, NotificationTemplateDto } from "@examora/types";
import { NOTIFICATION_CHANNELS } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { NotificationsNav } from "@/components/notifications-nav";
import { RequirePermission } from "@/components/require-permission";
import { useNotificationsAdminApi } from "@/lib/notifications-api";

function TemplatesContent() {
  const api = useNotificationsAdminApi();
  const [templates, setTemplates] = React.useState<NotificationTemplateDto[]>([]);
  const [eventType, setEventType] = React.useState("");
  const [channel, setChannel] = React.useState<NotificationChannel>("EMAIL");
  const [subject, setSubject] = React.useState("");
  const [bodyTemplate, setBodyTemplate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .listTemplates()
      .then((res) => setTemplates(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await api.createTemplate({
        eventType,
        channel,
        subject: subject || undefined,
        bodyTemplate,
      });
      setEventType("");
      setSubject("");
      setBodyTemplate("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create template");
    }
  }

  async function toggleActive(template: NotificationTemplateDto): Promise<void> {
    try {
      await api.updateTemplate(template.id, { isActive: !template.isActive });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update template");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <NotificationsNav />
      <h1 className="text-heading">Notification templates</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Optional per-(event, channel) content with <code>{"{{placeholder}}"}</code> variables — an
        event with no active template just uses its own raw title/body.
      </p>

      <form
        onSubmit={create}
        className="mt-6 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eventType">Event type</Label>
            <Input
              id="eventType"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="e.g. commerce.payment_success"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="channel">Channel</Label>
            <select
              id="channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as NotificationChannel)}
              className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            >
              {NOTIFICATION_CHANNELS.filter((c) => c !== "IN_APP" && c !== "MOBILE_PUSH").map(
                (c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subject">Subject (email only)</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bodyTemplate">Body template</Label>
          <textarea
            id="bodyTemplate"
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            rows={3}
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <FieldError>{error}</FieldError>
        <div>
          <Button type="submit">Create template</Button>
        </div>
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Event type</th>
              <th className="px-4 py-3 font-medium">Channel</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/notifications/templates/${template.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    {template.eventType}
                  </Link>
                </td>
                <td className="px-4 py-3">{template.channel}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      template.isActive
                        ? "bg-success-50 text-success-700"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {template.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" onClick={() => void toggleActive(template)}>
                    {template.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
            {templates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                  No templates yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function TemplatesPage() {
  return (
    <RequirePermission permission="notification:manage">
      <TemplatesContent />
    </RequirePermission>
  );
}
