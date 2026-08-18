"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { NotificationTemplateDto } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationsAdminApi } from "@/lib/notifications-api";

function TemplateDetailContent() {
  const { id } = useParams<{ id: string }>();
  const api = useNotificationsAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "not-found">("loading");
  const [template, setTemplate] = React.useState<NotificationTemplateDto | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setStatus("loading");
    api
      .getTemplate(id)
      .then((res) => {
        setTemplate(res);
        setStatus("ready");
      })
      .catch(() => setStatus("not-found"));
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

  if (status === "loading") {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32" />
        <Card>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-4 h-32 w-full" />
        </Card>
      </main>
    );
  }

  if (status === "not-found" || !template) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-2xl font-bold text-neutral-900">Template not found</h1>
        <Link
          href="/notifications/templates"
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          ← Back to templates
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/notifications/templates"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Templates
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-bold text-neutral-900">
          {template.eventType}{" "}
          <span className="font-normal text-neutral-400">· {template.channel}</span>
        </h1>
      </div>

      <Card>
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4">
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
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={template.isActive}
              onChange={(e) => setTemplate({ ...template, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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
      </Card>
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
