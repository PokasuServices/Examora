import Link from "next/link";
import { Eye, MessageCircle, ThumbsUp } from "lucide-react";
import type { ThreadSummary } from "@examora/types";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { authorDisplayName, timeAgo } from "@/lib/format";
import { Avatar } from "./avatar";
import { ThreadBadges } from "./thread-badges";

/** The primary discussion card, reused across Home, Discussion List, My Discussions, and Search. */
export function ThreadCard({
  thread,
  showBoard = true,
}: {
  thread: ThreadSummary;
  showBoard?: boolean;
}) {
  return (
    <Card interactive density="compact" className="!p-0">
      <Link
        href={`/community/threads/${thread.id}`}
        className="flex gap-3 rounded-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:gap-4"
      >
        <Avatar author={thread.author} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {showBoard ? <Chip tone="neutral">{thread.boardTitle}</Chip> : null}
            <ThreadBadges thread={thread} />
          </div>
          <h3 className="mt-1.5 truncate font-heading text-base font-semibold text-neutral-900">
            {thread.title}
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            {authorDisplayName(thread.author)} · {timeAgo(thread.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs text-neutral-500">
          <span className="flex items-center gap-1" title="Replies">
            <MessageCircle size={13} strokeWidth={1.75} aria-hidden="true" />
            {thread.replyCount}
          </span>
          <span className="flex items-center gap-1" title="Likes">
            <ThumbsUp size={13} strokeWidth={1.75} aria-hidden="true" />
            {thread.likeCount}
          </span>
          <span className="flex items-center gap-1" title="Views">
            <Eye size={13} strokeWidth={1.75} aria-hidden="true" />
            {thread.viewCount}
          </span>
        </div>
      </Link>
    </Card>
  );
}
