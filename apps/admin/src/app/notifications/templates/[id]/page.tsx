"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@examora/auth-client";
import type { NotificationTemplateDto } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { useNotificationsAdminApi } from "@/lib/notifications-api";

function TemplateDetailContent() {
  const { id } = useParams<{ id: string }>();
  const api = useNotificationsAdminApi();
  const [template, setTemplate] = React.useState<NotificationTemplateDto | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    api
      .getTemplate(id)
      .then(setTemplate)
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!template) return;
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      const updated = await api.updateTemplate(template.id, {
        subject: template.subject ?? undefined,
        bodyTemplate: template.bodyTemplate,
        isActive: template.isActive,
      });
      setTemplate(updated);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the template");
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-heading">Template not found</h1>
      </main>
    );
  }
  if (!template) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/notifications/templates" className="hover:underline">
          Templates
        </Link>{" "}
        · <span className="text-neutral-800">{template.eventType}</span>
      </nav>

      <h1 className="text-heading">
        {template.eventType} <span className="text-neutral-400">· {template.channel}</span>
      </h1>

      <form
        onSubmit={save}
        className="mt-6 flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subject">Subject (email only)</Label>
          <Input
            id="subject"
            value={template.subject ?? ""}
            onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bodyTemplate">Body template</Label>
          <textarea
            id="bodyTemplate"
            value={template.bodyTemplate}
            onChange={(e) => setTemplate({ ...template, bodyTemplate: e.target.value })}
            rows={6}
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={template.isActive}
            onChange={(e) => setTemplate({ ...template, isActive: e.target.checked })}
          />
          Active
        </label>
        <FieldError>{error}</FieldError>
        {success ? <p className="text-sm text-success-600">Template saved.</p> : null}
        <div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </main>
  );
}

export default function TemplateDetailPage() {
  return (
    <RequirePermission permission="notification:manage">
      <TemplateDetailContent />
    </RequirePermission>
  );
}
