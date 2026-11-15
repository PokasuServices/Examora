"use client";

import Link from "next/link";
import { ArrowLeft, Clock, FileEdit, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";

export function CmsEditorPageShell({
  backHref,
  backLabel,
  title,
  status,
  onRetry,
  workflowActions,
  fieldsForm,
  versionHistory,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  status: "loading" | "ready" | "not-found" | "error";
  onRetry: () => void;
  workflowActions: React.ReactNode;
  fieldsForm: React.ReactNode;
  versionHistory: React.ReactNode;
}) {
  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32" />
        <Card>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-4 h-32 w-full" />
        </Card>
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold text-neutral-800 dark:text-white/90">Not found</h1>
        <Link
          href={backHref}
          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >
          ← Back to {backLabel}
        </Link>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <RetryInline message="Couldn't load this content" onRetry={onRetry} />
        </Card>
      </div>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <div>
        <Link
          href={backHref}
          className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          {backLabel}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-800 dark:text-white/90">{title}</h1>
      </div>

      <Card>
        <div className="flex items-center gap-2">
          <IconBadge icon={Clock} tone="primary" />
          <h2 className="text-lg font-medium text-neutral-800 dark:text-white/90">
            Status &amp; publishing
          </h2>
        </div>
        <div className="mt-4">{workflowActions}</div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <IconBadge icon={FileEdit} tone="primary" />
          <h2 className="text-lg font-medium text-neutral-800 dark:text-white/90">Content</h2>
        </div>
        <div className="mt-4">{fieldsForm}</div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <IconBadge icon={History} tone="primary" />
          <h2 className="text-lg font-medium text-neutral-800 dark:text-white/90">
            Version history
          </h2>
        </div>
        <div className="mt-4">{versionHistory}</div>
      </Card>
    </main>
  );
}
