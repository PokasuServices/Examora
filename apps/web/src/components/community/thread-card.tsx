"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, MessageCircle } from "lucide-react";
import type { ThreadSummary } from "@examora/types";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { useCommunityApi } from "@/lib/community-api";
import { authorDisplayName, timeAgo } from "@/lib/format";
import { Avatar } from "./avatar";
import { ClapButton, ShareMenu } from "./clap-share";
import { ThreadBadges } from "./thread-badges";

/**
 * The discussion card used on Home, board lists, My Discussions and Search:
 * title and author, then clap / answer / share right on the card.
 */
export function ThreadCard({
  thread,
  showBoard = true,
}: {
  thread: ThreadSummary;
  showBoard?: boolean;
}) {
  const api = useCommunityApi();
  const [clap, setClap] = React.useState({
    clapped: thread.isLikedByViewer,
    count: thread.likeCount,
  });
  React.useEffect(
    () => setClap({ clapped: thread.isLikedByViewer, count: thread.likeCount }),
    [thread.isLikedByViewer, thread.likeCount],
  );
  const href = `/community/threads/${thread.id}`;

  async function toggleClap() {
    const before = clap;
    setClap({ clapped: !before.clapped, count: before.count + (before.clapped ? -1 : 1) });
    try {
      const res = await api.toggleThreadLike(thread.id);
      setClap({ clapped: res.liked, count: res.likeCount });
    } catch {
      setClap(before);
    }
  }

  return (
    <Card density="compact" className="flex flex-col gap-3">
      <div className="flex gap-3 sm:gap-4">
        <Avatar author={thread.author} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {showBoard ? <Chip tone="neutral">{thread.boardTitle}</Chip> : null}
            <ThreadBadges thread={thread} />
          </div>
          <h3 className="mt-1.5 text-base font-medium text-neutral-800 dark:text-white/90">
            <Link
              href={href}
              className="line-clamp-2 rounded hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:text-primary-400"
            >
              {thread.title}
            </Link>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              {authorDisplayName(thread.author)} · {timeAgo(thread.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye size={12} strokeWidth={1.75} aria-hidden="true" />
              {thread.viewCount} <span className="sr-only">views</span>
            </span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
        <ClapButton size="sm" clapped={clap.clapped} count={clap.count} onToggle={toggleClap} />
        <Link
          href={`${href}#reply`}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-xs font-medium text-neutral-600 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-white/[0.03]"
        >
          <MessageCircle size={14} strokeWidth={1.75} aria-hidden="true" />
          {thread.type === "QUESTION" ? "Answer" : "Reply"}
          <span className="tabular-nums">{thread.replyCount}</span>
        </Link>
        <div className="ml-auto">
          <ShareMenu size="sm" path={href} title={thread.title} />
        </div>
      </div>
    </Card>
  );
}
