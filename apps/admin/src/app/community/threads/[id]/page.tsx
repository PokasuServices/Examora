"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { ThreadDetail } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommunityAdminApi } from "@/lib/community-api";

type PendingAction = "HIDE" | "RESTORE" | "LOCK" | "UNLOCK" | "PIN" | "UNPIN" | null;

function AdminThreadDetailContent() {
  const { id: threadId } = useParams<{ id: string }>();
  const api = useCommunityAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [thread, setThread] = React.useState<ThreadDetail | null>(null);
  const [pending, setPending] = React.useState<PendingAction>(null);
  const [hideReason, setHideReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .getThread(threadId)
      .then((data) => {
        setThread(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  React.useEffect(() => {
    load();
  }, [load]);

  function openAction(action: Exclude<PendingAction, null>): void {
    setError(null);
    if (action === "HIDE") setHideReason("");
    setPending(action);
  }

  async function confirmAction(): Promise<void> {
    if (!pending) return;
    setError(null);
    if (pending === "HIDE" && !hideReason.trim()) {
      setError("A reason is required to hide this thread.");
      return;
    }
    setSubmitting(true);
    try {
      if (pending === "HIDE") await api.hideThread(threadId, hideReason.trim());
      else if (pending === "RESTORE") await api.restoreThread(threadId);
      else if (pending === "LOCK") await api.lockThread(threadId);
      else if (pending === "UNLOCK") await api.unlockThread(threadId);
      else if (pending === "PIN") await api.pinThread(threadId);
      else if (pending === "UNPIN") await api.unpinThread(threadId);
      setPending(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete this action");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-4 w-32" />
        <Card>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-4 h-24 w-full" />
        </Card>
      </main>
    );
  }

  if (status === "error" || !thread) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <RetryInline message="Couldn't load this thread" onRetry={load} />
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/community/moderation"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Moderation queue
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-bold text-neutral-900">{thread.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {thread.isHidden ? <Chip tone="danger">Hidden</Chip> : null}
          {thread.isLocked ? <Chip tone="neutral">Locked</Chip> : null}
          {thread.isPinned ? <Chip tone="warning">Pinned</Chip> : null}
        </div>
      </div>

      <FieldError>{error}</FieldError>

      <Card>
        {thread.hiddenReason ? (
          <p className="text-sm text-danger-600">Hidden reason: {thread.hiddenReason}</p>
        ) : null}
        <p
          className={
            thread.hiddenReason
              ? "mt-3 whitespace-pre-wrap text-sm text-neutral-700"
              : "whitespace-pre-wrap text-sm text-neutral-700"
          }
        >
          {thread.body}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {thread.isHidden ? (
            <Button onClick={() => openAction("RESTORE")}>Restore</Button>
          ) : (
            <Button variant="secondary" onClick={() => openAction("HIDE")}>
              Hide
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => openAction(thread.isLocked ? "UNLOCK" : "LOCK")}
          >
            {thread.isLocked ? "Unlock" : "Lock"}
          </Button>
          <Button variant="secondary" onClick={() => openAction(thread.isPinned ? "UNPIN" : "PIN")}>
            {thread.isPinned ? "Unpin" : "Pin"}
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending === "HIDE"
            ? "Hide this thread?"
            : pending === "RESTORE"
              ? "Restore this thread?"
              : pending === "LOCK"
                ? "Lock this thread?"
                : pending === "UNLOCK"
                  ? "Unlock this thread?"
                  : pending === "PIN"
                    ? "Pin this thread?"
                    : "Unpin this thread?"
        }
        message={
          pending === "HIDE" ? (
            <div className="flex flex-col gap-1.5 text-left">
              <p>The thread will be hidden from students. This action requires a reason.</p>
              <Label htmlFor="hide-reason">Reason</Label>
              <Input
                id="hide-reason"
                value={hideReason}
                onChange={(e) => setHideReason(e.target.value)}
              />
            </div>
          ) : pending === "RESTORE" ? (
            "This makes the thread visible to students again."
          ) : pending === "LOCK" ? (
            "Students won't be able to post new replies."
          ) : pending === "UNLOCK" ? (
            "Students will be able to post replies again."
          ) : pending === "PIN" ? (
            "Pinned threads stay at the top of the board."
          ) : (
            "This removes it from the pinned position."
          )
        }
        confirmLabel={
          pending === "HIDE"
            ? "Hide thread"
            : pending === "RESTORE"
              ? "Restore"
              : pending === "LOCK"
                ? "Lock"
                : pending === "UNLOCK"
                  ? "Unlock"
                  : pending === "PIN"
                    ? "Pin"
                    : "Unpin"
        }
        tone={pending === "HIDE" ? "danger" : "primary"}
        submitting={submitting}
        error={error}
        onConfirm={() => void confirmAction()}
        onCancel={() => setPending(null)}
      />
    </main>
  );
}

export default function AdminThreadDetailPage() {
  return (
    <RequirePermission permission="community:moderate">
      <AdminThreadDetailContent />
    </RequirePermission>
  );
}
