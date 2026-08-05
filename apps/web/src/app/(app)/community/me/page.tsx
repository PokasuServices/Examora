"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@examora/auth-client";
import { Info, MessagesSquare } from "lucide-react";
import type { ThreadSummary } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { ThreadCard } from "@/components/community/thread-card";
import { ThreadCardSkeletonList } from "@/components/community/skeletons";
import { useCommunityApi } from "@/lib/community-api";

type Tab = "created" | "bookmarked" | "solved";
type Status = "loading" | "ready" | "error";

const TABS: { value: Tab; label: string }[] = [
  { value: "created", label: "Created" },
  { value: "bookmarked", label: "Bookmarked" },
  { value: "solved", label: "Solved" },
];

const EMPTY_COPY: Record<Tab, { heading: string; body: string }> = {
  created: {
    heading: "You haven't started any discussions",
    body: "Ask a question or start a discussion to see it here.",
  },
  bookmarked: { heading: "No bookmarks yet", body: "Bookmark a thread to save it for later." },
  solved: {
    heading: "No solved questions yet",
    body: "Questions you asked get listed here once an answer is accepted.",
  },
};

function MyDiscussionsContent() {
  const { user } = useAuth();
  const api = useCommunityApi();
  const [tab, setTab] = React.useState<Tab>("created");
  const [status, setStatus] = React.useState<Status>("loading");
  const [threads, setThreads] = React.useState<ThreadSummary[]>([]);

  const load = React.useCallback(() => {
    if (!user) return;
    setStatus("loading");
    const request =
      tab === "bookmarked"
        ? api.listBookmarks()
        : tab === "solved"
          ? api.listThreads({ authorId: user.id, solved: true, pageSize: 50 })
          : api.listThreads({ authorId: user.id, pageSize: 50 });
    request
      .then((res) => {
        setThreads(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user?.id]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
        <Link href="/community" className="hover:text-primary-600 hover:underline">
          Community
        </Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            My discussions
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Everything you&rsquo;ve started, bookmarked, or gotten solved.
          </p>
        </div>
        {user ? (
          <Link
            href={`/community/profile/${user.id}`}
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            View my profile →
          </Link>
        ) : null}
      </div>

      <SegmentedControl
        aria-label="My discussions filter"
        value={tab}
        onChange={setTab}
        options={TABS}
      />

      <div className="flex items-start gap-2 rounded-md bg-neutral-100 px-3 py-2.5 text-xs text-neutral-500">
        <Info size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          Threads you follow aren&rsquo;t listed here — the API can toggle following on a thread but
          doesn&rsquo;t yet offer a way to list everything you follow. Use the Follow button on a
          thread you&rsquo;ve already opened to manage it directly.
        </p>
      </div>

      {status === "loading" ? (
        <ThreadCardSkeletonList count={5} />
      ) : status === "error" ? (
        <RetryInline message="Couldn't load your discussions" onRetry={load} />
      ) : threads.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          heading={EMPTY_COPY[tab].heading}
          body={EMPTY_COPY[tab].body}
          actionLabel={tab === "created" ? "Start a discussion" : undefined}
          actionHref={tab === "created" ? "/community/new" : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {threads.map((thread) => (
            <ThreadCard key={thread.id} thread={thread} />
          ))}
        </div>
      )}
    </main>
  );
}

export default function MyDiscussionsPage() {
  return (
    <RequireAuth>
      <MyDiscussionsContent />
    </RequireAuth>
  );
}
