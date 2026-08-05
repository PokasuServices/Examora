"use client";

import * as React from "react";
import { Bookmark, Check, Link2, ThumbsUp } from "lucide-react";
import type { ThreadDetail } from "@examora/types";
import { cn } from "@examora/ui";

function ReactionButton({
  pressed,
  onClick,
  icon: Icon,
  label,
  pressedLabel,
  count,
}: {
  pressed: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
  label: string;
  pressedLabel?: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
        pressed
          ? "border-primary-200 bg-primary-50 text-primary-700"
          : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
      )}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden />
      {pressed && pressedLabel ? pressedLabel : label}
      {count !== undefined ? <span className="tabular-nums">{count}</span> : null}
    </button>
  );
}

/** Like/Bookmark/Follow/Share — Share is frontend-only (copy link), no backend concept of "shares" exists (ADR-0017). */
export function ReactionBar({
  thread,
  onToggleLike,
  onToggleBookmark,
  onToggleFollow,
}: {
  thread: ThreadDetail;
  onToggleLike: () => void;
  onToggleBookmark: () => void;
  onToggleFollow: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (permissions/older browsers) — silently ignored, link stays copyable manually from the address bar.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Thread reactions">
      <ReactionButton
        pressed={thread.isLikedByViewer}
        onClick={onToggleLike}
        icon={ThumbsUp}
        label="Like"
        pressedLabel="Liked"
        count={thread.likeCount}
      />
      <ReactionButton
        pressed={thread.isBookmarkedByViewer}
        onClick={onToggleBookmark}
        icon={Bookmark}
        label="Bookmark"
        pressedLabel="Bookmarked"
      />
      <ReactionButton
        pressed={thread.isFollowedByViewer}
        onClick={onToggleFollow}
        icon={Check}
        label="Follow"
        pressedLabel="Following"
      />
      <button
        type="button"
        onClick={() => void handleShare()}
        className="flex h-10 items-center gap-2 rounded-full border border-neutral-200 px-4 text-sm font-medium text-neutral-600 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <Link2 size={16} strokeWidth={1.75} aria-hidden />
        {copied ? "Link copied!" : "Share"}
      </button>
    </div>
  );
}
