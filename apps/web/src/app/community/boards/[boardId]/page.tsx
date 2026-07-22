"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ForumBoard, ThreadSummary } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { useCommunityApi } from "@/lib/community-api";

function ThreadBadge({ thread }: { thread: ThreadSummary }): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
      <span className="rounded-full bg-neutral-100 px-2 py-0.5">{thread.type}</span>
      {thread.isPinned ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Pinned</span>
      ) : null}
      {thread.isLocked ? (
        <span className="rounded-full bg-neutral-200 px-2 py-0.5">Locked</span>
      ) : null}
      {thread.status === "CLOSED" ? (
        <span className="rounded-full bg-neutral-200 px-2 py-0.5">Closed</span>
      ) : null}
      {thread.type === "QUESTION" && thread.isSolved ? (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">Solved</span>
      ) : null}
    </div>
  );
}

function BoardThreadsContent() {
  const { boardId } = useParams<{ boardId: string }>();
  const api = useCommunityApi();
  const [board, setBoard] = React.useState<ForumBoard | null>(null);
  const [threads, setThreads] = React.useState<ThreadSummary[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api
      .getBoard(boardId)
      .then(setBoard)
      .catch(() => undefined);
    api
      .listThreads({ boardId, pageSize: 50 })
      .then((res) => setThreads(res.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <nav className="mb-4 text-sm text-neutral-500">
        <Link href="/community" className="hover:underline">
          Community
        </Link>{" "}
        · <span className="text-neutral-800">{board?.title ?? "…"}</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-heading">{board?.title ?? "Board"}</h1>
        <Link
          href={`/community/boards/${boardId}/new`}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          New thread
        </Link>
      </div>

      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}
      {!loading && threads.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No threads yet — start the discussion.</p>
      ) : null}

      <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {threads.map((thread) => (
          <li key={thread.id} className="px-4 py-4">
            <Link href={`/community/threads/${thread.id}`} className="hover:underline">
              <h2 className="font-medium">{thread.title}</h2>
            </Link>
            <ThreadBadge thread={thread} />
            <p className="mt-2 text-xs text-neutral-500">
              by {thread.author.firstName ?? thread.author.email} · {thread.replyCount} repl
              {thread.replyCount === 1 ? "y" : "ies"} · {thread.likeCount} like
              {thread.likeCount === 1 ? "" : "s"} · {thread.viewCount} views
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function BoardThreadsPage() {
  return (
    <RequireAuth>
      <BoardThreadsContent />
    </RequireAuth>
  );
}
