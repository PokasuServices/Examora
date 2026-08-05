"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Flag, MessageSquare, ThumbsUp } from "lucide-react";
import type { Reply } from "@examora/types";
import { cn } from "@examora/ui";
import { authorDisplayName, timeAgo } from "@/lib/format";
import { Avatar } from "./avatar";
import { ReplyComposer } from "./reply-composer";

/** Total reply count including nested children — listReplies only returns top-level items with children[] attached. */
export function countReplies(replies: Reply[]): number {
  return replies.reduce((sum, r) => sum + 1 + countReplies(r.children), 0);
}

export interface ReplyTreeActions {
  isQuestion: boolean;
  isThreadAuthor: boolean;
  onReply: (parentReplyId: string, body: string) => Promise<void>;
  onToggleLike: (replyId: string) => Promise<void>;
  onAccept: (replyId: string) => Promise<void>;
  onUnaccept: () => Promise<void>;
  onReport: (replyId: string) => void;
  threadLocked: boolean;
}

function ReplyNode({
  reply,
  actions,
  depth,
}: {
  reply: Reply;
  actions: ReplyTreeActions;
  depth: number;
}) {
  const [replying, setReplying] = React.useState(false);

  return (
    <div
      className={cn(
        "rounded-card border p-4",
        reply.isAcceptedAnswer
          ? "border-success-200 bg-success-50/60"
          : "border-neutral-900/[0.06] bg-white",
      )}
    >
      {reply.isAcceptedAnswer ? (
        <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-success-700">
          <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />
          Accepted answer
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <Avatar author={reply.author} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              href={`/community/profile/${reply.author.id}`}
              className="text-sm font-semibold text-neutral-900 hover:underline"
            >
              {authorDisplayName(reply.author)}
            </Link>
            <span className="text-xs text-neutral-400">{timeAgo(reply.createdAt)}</span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-neutral-800">{reply.body}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs font-medium text-neutral-500">
            <button
              type="button"
              onClick={() => void actions.onToggleLike(reply.id)}
              aria-pressed={reply.isLikedByViewer}
              className={cn(
                "flex items-center gap-1 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded",
                reply.isLikedByViewer && "text-primary-600",
              )}
            >
              <ThumbsUp size={13} strokeWidth={1.75} aria-hidden="true" />
              {reply.likeCount > 0 ? reply.likeCount : "Like"}
            </button>
            {!actions.threadLocked ? (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className="flex items-center gap-1 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
              >
                <MessageSquare size={13} strokeWidth={1.75} aria-hidden="true" />
                Reply
              </button>
            ) : null}
            {actions.isQuestion && actions.isThreadAuthor && !actions.threadLocked ? (
              reply.isAcceptedAnswer ? (
                <button
                  type="button"
                  onClick={() => void actions.onUnaccept()}
                  className="text-success-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                >
                  Unaccept answer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void actions.onAccept(reply.id)}
                  className="hover:text-success-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                >
                  Accept as answer
                </button>
              )
            ) : null}
            <button
              type="button"
              onClick={() => actions.onReport(reply.id)}
              className="ml-auto flex items-center gap-1 text-neutral-400 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              <Flag size={13} strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only">Report reply</span>
            </button>
          </div>

          {replying ? (
            <div className="mt-3">
              <ReplyComposer
                focusOnOpen
                placeholder={`Reply to ${authorDisplayName(reply.author)}…`}
                onSubmit={async (body) => {
                  await actions.onReply(reply.id, body);
                  setReplying(false);
                }}
                onCancel={() => setReplying(false)}
              />
            </div>
          ) : null}

          {reply.children.length > 0 ? (
            <div
              className={cn(
                "mt-3 flex flex-col gap-3",
                depth < 3 && "border-l border-neutral-200 pl-4",
              )}
            >
              {reply.children.map((child) => (
                <ReplyNode key={child.id} reply={child} actions={actions} depth={depth + 1} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ReplyTree({ replies, actions }: { replies: Reply[]; actions: ReplyTreeActions }) {
  return (
    <div className="flex flex-col gap-3">
      {replies.map((reply) => (
        <ReplyNode key={reply.id} reply={reply} actions={actions} depth={0} />
      ))}
    </div>
  );
}
