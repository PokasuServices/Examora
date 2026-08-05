import { HelpCircle, Lock, MessageSquare, Pin } from "lucide-react";
import type { ThreadSummary } from "@examora/types";
import { Chip } from "@/components/ui/chip";

/** The status/flag chip row shared by ThreadCard and the Discussion Details hero. */
export function ThreadBadges({ thread }: { thread: ThreadSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip tone={thread.type === "QUESTION" ? "accent" : "neutral"} className="gap-1">
        {thread.type === "QUESTION" ? (
          <HelpCircle size={12} strokeWidth={2} aria-hidden="true" />
        ) : (
          <MessageSquare size={12} strokeWidth={2} aria-hidden="true" />
        )}
        {thread.type === "QUESTION" ? "Question" : "Discussion"}
      </Chip>
      {thread.type === "QUESTION" && thread.isSolved ? <Chip tone="success">Solved</Chip> : null}
      {thread.isPinned ? (
        <Chip tone="warning" className="gap-1">
          <Pin size={12} strokeWidth={2} aria-hidden="true" />
          Pinned
        </Chip>
      ) : null}
      {thread.isLocked ? (
        <Chip tone="neutral" className="gap-1">
          <Lock size={12} strokeWidth={2} aria-hidden="true" />
          Locked
        </Chip>
      ) : null}
      {thread.status === "CLOSED" ? <Chip tone="neutral">Closed</Chip> : null}
    </div>
  );
}
