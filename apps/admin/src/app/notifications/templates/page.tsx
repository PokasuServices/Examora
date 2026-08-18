"use client";

import * as React from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { NotificationChannel, NotificationTemplateDto } from "@examora/types";
import { NOTIFICATION_CHANNELS } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationsAdminApi } from "@/lib/notifications-api";

const CREATABLE_CHANNELS = NOTIFICATION_CHANNELS.filter(
  (c) => c !== "IN_APP" && c !== "MOBILE_PUSH",
);

function TemplatesContent() {
  const api = useNotificationsAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [templates, setTemplates] = React.useState<NotificationTemplateDto[]>([]);
  const [formOpen, setFormOpen] = React.useState(false);
  const [eventType, setEventType] = React.useState("");
  const [channel, setChannel] = React.useState<NotificationChannel>("EMAIL");
  const [subject, setSubject] = React.useState("");
  const [bodyTemplate, setBodyTemplate] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listTemplates()
      .then((res) => {
        setTemplates(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
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
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create template");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(template: NotificationTemplateDto): Promise<void> {
    setError(null);
    try {
      await api.updateTemplate(template.id, { isActive: !template.isActive });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update template");
    }
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Notification templates"
        subtitle="Optional per-(event, channel) content with {{placeholder}} variables — an event with no active template just uses its own raw title/body."
        actions={
          !formOpen ? <Button onClick={() => setFormOpen(true)}>New template</Button> : undefined
        }
      />

      {formOpen ? (
        <form
          onSubmit={(e) => void create(e)}
          className="flex flex-col gap-4 rounded-md border border-neutral-100 bg-neutral-50/50 p-4"
        >
          <h3 className="font-heading text-sm font-semibold text-neutral-900">New template</h3>
          <div className="grid gap-4 sm:grid-cols-2">
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
            <SelectField
              id="channel"
              label="Channel"
              value={channel}
              options={CREATABLE_CHANNELS.map((c) => ({ value: c, label: c }))}
              onChange={(v) => setChannel(v as NotificationChannel)}
            />
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
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1"
            />
          </div>
          <FieldError>{error}</FieldError>
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={submitting || !eventType.trim() || !bodyTemplate.trim()}
            >
              {submitting ? "Creating…" : "Create template"}
            </Button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-sm font-medium text-neutral-600 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load templates" onRetry={load} />
        ) : templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            heading="No templates yet"
            body="Create the first one to get started."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Event type
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Channel
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/notifications/templates/${template.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {template.eventType}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{template.channel}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Chip tone={template.isActive ? "success" : "neutral"}>
                        {template.isActive ? "Active" : "Inactive"}
                      </Chip>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void toggleActive(template)}
                        className="text-sm font-medium text-primary-600 hover:underline"
                      >
                        {template.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
