"use client";

import * as React from "react";
import { Bookmark, Check } from "lucide-react";
import type { ThreadDetail } from "@examora/types";
import { cn } from "@examora/ui";
import { ClapButton, ShareMenu } from "./clap-share";

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
          ? "border-primary-200 dark:border-primary-500/30 bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300"
          : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/[0.03]",
      )}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden />
      {pressed && pressedLabel ? pressedLabel : label}
      {count !== undefined ? <span className="tabular-nums">{count}</span> : null}
    </button>
  );
}

/** Clap/Bookmark/Follow/Share. Share is frontend-only (social links, copy link); there is no backend "share" concept (ADR-0017). */
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
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Thread reactions">
      <ClapButton
        clapped={thread.isLikedByViewer}
        count={thread.likeCount}
        onToggle={onToggleLike}
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
      <ShareMenu path={`/community/threads/${thread.id}`} title={thread.title} />
    </div>
  );
}
