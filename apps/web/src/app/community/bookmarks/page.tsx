"use client";

import * as React from "react";
import Link from "next/link";
import type { ThreadSummary } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { useCommunityApi } from "@/lib/community-api";

function BookmarksContent() {
  const api = useCommunityApi();
  const [threads, setThreads] = React.useState<ThreadSummary[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api
      .listBookmarks()
      .then((res) => setThreads(res.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-4 text-sm text-neutral-500">
        <Link href="/community" className="hover:underline">
          Community
        </Link>
      </nav>

      <h1 className="text-heading">My bookmarks</h1>

      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}
      {!loading && threads.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">You haven&rsquo;t bookmarked anything yet.</p>
      ) : null}

      <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {threads.map((thread) => (
          <li key={thread.id} className="px-4 py-4">
            <Link href={`/community/threads/${thread.id}`} className="hover:underline">
              <h2 className="font-medium">{thread.title}</h2>
            </Link>
            <p className="mt-1 text-xs text-neutral-500">
              {thread.boardTitle} · {thread.type}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function BookmarksPage() {
  return (
    <RequireAuth>
      <BookmarksContent />
    </RequireAuth>
  );
}
