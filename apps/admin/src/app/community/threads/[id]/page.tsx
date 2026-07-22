"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ThreadDetail } from "@examora/types";
import { Button } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { useCommunityAdminApi } from "@/lib/community-api";

function AdminThreadDetailContent() {
  const { id: threadId } = useParams<{ id: string }>();
  const api = useCommunityAdminApi();
  const [thread, setThread] = React.useState<ThreadDetail | null>(null);

  const load = React.useCallback(() => {
    api
      .getThread(threadId)
      .then(setThread)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function hide(): Promise<void> {
    const reason = window.prompt("Reason for hiding this thread?");
    if (!reason) return;
    await api.hideThread(threadId, reason);
    load();
  }

  async function restore(): Promise<void> {
    await api.restoreThread(threadId);
    load();
  }

  async function toggleLock(): Promise<void> {
    if (thread?.isLocked) await api.unlockThread(threadId);
    else await api.lockThread(threadId);
    load();
  }

  async function togglePin(): Promise<void> {
    if (thread?.isPinned) await api.unpinThread(threadId);
    else await api.pinThread(threadId);
    load();
  }

  if (!thread) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-4 text-sm text-neutral-500">
        <Link href="/community/moderation" className="hover:underline">
          Moderation queue
        </Link>
      </nav>

      <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
        {thread.isHidden ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">Hidden</span>
        ) : null}
        {thread.isLocked ? (
          <span className="rounded-full bg-neutral-200 px-2 py-0.5">Locked</span>
        ) : null}
        {thread.isPinned ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Pinned</span>
        ) : null}
      </div>

      <h1 className="mt-2 text-heading">{thread.title}</h1>
      {thread.hiddenReason ? (
        <p className="mt-1 text-sm text-error-600">Hidden reason: {thread.hiddenReason}</p>
      ) : null}
      <p className="mt-4 whitespace-pre-wrap text-body">{thread.body}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {thread.isHidden ? (
          <Button onClick={() => void restore()}>Restore</Button>
        ) : (
          <Button variant="secondary" onClick={() => void hide()}>
            Hide
          </Button>
        )}
        <Button variant="secondary" onClick={() => void toggleLock()}>
          {thread.isLocked ? "Unlock" : "Lock"}
        </Button>
        <Button variant="secondary" onClick={() => void togglePin()}>
          {thread.isPinned ? "Unpin" : "Pin"}
        </Button>
      </div>
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
