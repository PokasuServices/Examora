"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@examora/auth-client";
import {
  Award,
  Bookmark,
  MessageSquare,
  MessagesSquare,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import type {
  CommunityActivityEventType,
  CommunityAuthorSummary,
  CommunityActivityItem,
  ReputationEventItem,
  ThreadSummary,
} from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { authorDisplayName, timeAgo } from "@/lib/format";
import { Avatar } from "@/components/community/avatar";
import { ThreadCard } from "@/components/community/thread-card";
import { useCommunityApi } from "@/lib/community-api";

const ACTIVITY_ICON: Record<CommunityActivityEventType, LucideIcon> = {
  THREAD_CREATED: MessagesSquare,
  REPLY_POSTED: MessageSquare,
  LIKE_GIVEN: ThumbsUp,
  REPUTATION_EVENT: Award,
};

type Status = "loading" | "ready" | "error";

interface ProfileData {
  reputationPoints: number;
  events: ReputationEventItem[];
  activity: CommunityActivityItem[];
  threads: ThreadSummary[];
  threadCount: number;
  bookmarks: ThreadSummary[];
}

function CommunityProfileContent() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const api = useCommunityApi();
  const isSelf = user?.id === userId;

  const [status, setStatus] = React.useState<Status>("loading");
  const [data, setData] = React.useState<ProfileData | null>(null);
  const [author, setAuthor] = React.useState<CommunityAuthorSummary | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    Promise.all([
      api.getReputation(userId),
      api.getReputationEvents(userId),
      api.getActivity(userId),
      api.listThreads({ authorId: userId, pageSize: 5 }),
      isSelf ? api.listBookmarks() : Promise.resolve({ items: [] as ThreadSummary[] }),
    ])
      .then(([reputation, events, activity, threads, bookmarks]) => {
        setData({
          reputationPoints: reputation.reputationPoints,
          events: events.items,
          activity,
          threads: threads.items,
          threadCount: threads.total,
          bookmarks: bookmarks.items.slice(0, 5),
        });
        if (threads.items[0]) setAuthor(threads.items[0].author);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isSelf]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (status === "error") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <RetryInline message="Couldn't load this profile" onRetry={load} />
      </main>
    );
  }

  const displayAuthor: CommunityAuthorSummary =
    author ??
    (isSelf && user
      ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
        }
      : { id: userId, email: "", firstName: null, lastName: null });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
        <Link href="/community" className="hover:text-primary-600 hover:underline">
          Community
        </Link>
      </nav>

      <Card className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
        <Avatar author={displayAuthor} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-bold text-neutral-900">
            {status === "loading"
              ? "Loading…"
              : displayAuthor.email
                ? authorDisplayName(displayAuthor)
                : "Community member"}
          </h1>
          {displayAuthor.email ? (
            <p className="text-sm text-neutral-500">{displayAuthor.email}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap justify-center gap-4 sm:justify-start">
            <div>
              <p className="font-heading text-lg font-bold text-neutral-900">
                {data ? data.reputationPoints : "–"}
              </p>
              <p className="text-xs text-neutral-500">Reputation</p>
            </div>
            <div>
              <p className="font-heading text-lg font-bold text-neutral-900">
                {data ? data.threadCount : "–"}
              </p>
              <p className="text-xs text-neutral-500">Discussions started</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent threads */}
      <section aria-labelledby="profile-threads-heading">
        <h2
          id="profile-threads-heading"
          className="font-heading text-lg font-semibold text-neutral-900"
        >
          Recent discussions
        </h2>
        <div className="mt-3">
          {status === "loading" ? (
            <p className="text-sm text-neutral-400">Loading…</p>
          ) : !data || data.threads.length === 0 ? (
            <EmptyState icon={MessagesSquare} heading="No discussions yet" />
          ) : (
            <div className="flex flex-col gap-3">
              {data.threads.map((thread) => (
                <ThreadCard key={thread.id} thread={thread} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Activity */}
      <section aria-labelledby="profile-activity-heading">
        <h2
          id="profile-activity-heading"
          className="font-heading text-lg font-semibold text-neutral-900"
        >
          Recent activity
        </h2>
        <Card className="mt-3">
          {status === "loading" ? (
            <p className="text-sm text-neutral-400">Loading…</p>
          ) : !data || data.activity.length === 0 ? (
            <EmptyState heading="No activity yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-100">
              {data.activity.slice(0, 12).map((item, i) => {
                const Icon = ACTIVITY_ICON[item.type];
                return (
                  <li key={i} className="flex items-start gap-3 py-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-600"
                    >
                      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm text-neutral-800">{item.title}</p>
                        <span className="shrink-0 text-xs text-neutral-400">
                          {timeAgo(item.occurredAt)}
                        </span>
                      </div>
                      {item.description ? (
                        <p className="mt-0.5 truncate text-xs text-neutral-500">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* Reputation ledger */}
      <section aria-labelledby="profile-reputation-heading">
        <h2
          id="profile-reputation-heading"
          className="font-heading text-lg font-semibold text-neutral-900"
        >
          Reputation history
        </h2>
        <Card className="mt-3">
          {status === "loading" ? (
            <p className="text-sm text-neutral-400">Loading…</p>
          ) : !data || data.events.length === 0 ? (
            <EmptyState icon={Award} heading="No reputation events yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-100">
              {data.events.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-neutral-800">{event.reason}</p>
                    <p className="text-xs text-neutral-400">{timeAgo(event.createdAt)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-700">
                    +{event.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Bookmarks — only ever visible on your own profile: the API always scopes bookmarks to the caller */}
      {isSelf ? (
        <section aria-labelledby="profile-bookmarks-heading">
          <div className="flex items-center justify-between">
            <h2
              id="profile-bookmarks-heading"
              className="font-heading text-lg font-semibold text-neutral-900"
            >
              Your bookmarks
            </h2>
            <Link
              href="/community/me"
              className="text-xs font-medium text-primary-600 hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="mt-3">
            {status === "loading" ? (
              <p className="text-sm text-neutral-400">Loading…</p>
            ) : !data || data.bookmarks.length === 0 ? (
              <EmptyState icon={Bookmark} heading="No bookmarks yet" />
            ) : (
              <div className="flex flex-col gap-3">
                {data.bookmarks.map((thread) => (
                  <ThreadCard key={thread.id} thread={thread} />
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default function CommunityProfilePage() {
  return (
    <RequireAuth>
      <CommunityProfileContent />
    </RequireAuth>
  );
}
