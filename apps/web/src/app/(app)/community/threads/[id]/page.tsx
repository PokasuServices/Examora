"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Reply, ThreadDetail } from "@examora/types";
import { useAuth } from "@examora/auth-client";
import { Button } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { useCommunityApi } from "@/lib/community-api";

function ReplyNode({
  reply,
  threadId,
  isQuestion,
  isThreadAuthor,
  onReplied,
  onAccept,
}: {
  reply: Reply;
  threadId: string;
  isQuestion: boolean;
  isThreadAuthor: boolean;
  onReplied: () => void;
  onAccept: (replyId: string) => void;
}): React.ReactElement {
  const api = useCommunityApi();
  const [replying, setReplying] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [liked, setLiked] = React.useState(reply.isLikedByViewer);
  const [likeCount, setLikeCount] = React.useState(reply.likeCount);

  async function submitReply(): Promise<void> {
    if (!body.trim()) return;
    await api.createReply(threadId, body, reply.id);
    setBody("");
    setReplying(false);
    onReplied();
  }

  async function toggleLike(): Promise<void> {
    const res = await api.toggleReplyLike(reply.id);
    setLiked(res.liked);
    setLikeCount(res.likeCount);
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      {reply.isAcceptedAnswer ? (
        <span className="mb-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
          Accepted answer
        </span>
      ) : null}
      <p className="whitespace-pre-wrap text-sm">{reply.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
        <span>{reply.author.firstName ?? reply.author.email}</span>
        <button onClick={() => void toggleLike()} className="hover:underline">
          {liked ? "Liked" : "Like"} ({likeCount})
        </button>
        <button onClick={() => setReplying((v) => !v)} className="hover:underline">
          Reply
        </button>
        {isQuestion && isThreadAuthor && !reply.isAcceptedAnswer ? (
          <button onClick={() => onAccept(reply.id)} className="text-green-700 hover:underline">
            Accept as answer
          </button>
        ) : null}
      </div>

      {replying ? (
        <div className="mt-3 flex gap-2">
          <textarea
            className="min-h-16 w-full rounded-md border border-neutral-300 p-2 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a reply…"
          />
          <Button onClick={() => void submitReply()}>Post</Button>
        </div>
      ) : null}

      {reply.children.length > 0 ? (
        <div className="mt-3 space-y-3 border-l border-neutral-200 pl-4">
          {reply.children.map((child) => (
            <ReplyNode
              key={child.id}
              reply={child}
              threadId={threadId}
              isQuestion={isQuestion}
              isThreadAuthor={isThreadAuthor}
              onReplied={onReplied}
              onAccept={onAccept}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ThreadDetailContent() {
  const { id: threadId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const api = useCommunityApi();
  const [thread, setThread] = React.useState<ThreadDetail | null>(null);
  const [replies, setReplies] = React.useState<Reply[]>([]);
  const [newReplyBody, setNewReplyBody] = React.useState("");
  const [notFound, setNotFound] = React.useState(false);

  const loadReplies = React.useCallback(() => {
    api
      .listReplies(threadId)
      .then((res) => setReplies(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  React.useEffect(() => {
    api
      .getThread(threadId)
      .then(setThread)
      .catch(() => setNotFound(true));
    loadReplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  async function refreshThread(): Promise<void> {
    const updated = await api.getThread(threadId);
    setThread(updated);
  }

  async function handlePostReply(): Promise<void> {
    if (!newReplyBody.trim()) return;
    await api.createReply(threadId, newReplyBody);
    setNewReplyBody("");
    loadReplies();
  }

  async function handleAccept(replyId: string): Promise<void> {
    await api.acceptAnswer(threadId, replyId);
    await refreshThread();
    loadReplies();
  }

  async function handleToggleLike(): Promise<void> {
    await api.toggleThreadLike(threadId);
    await refreshThread();
  }

  async function handleToggleBookmark(): Promise<void> {
    await api.toggleBookmark(threadId);
    await refreshThread();
  }

  async function handleToggleFollow(): Promise<void> {
    await api.toggleFollow(threadId);
    await refreshThread();
  }

  async function handleToggleStatus(): Promise<void> {
    if (!thread) return;
    if (thread.status === "OPEN") await api.closeThread(threadId);
    else await api.reopenThread(threadId);
    await refreshThread();
  }

  async function handleReport(): Promise<void> {
    const reason = window.prompt("Why are you reporting this thread?");
    if (!reason) return;
    await api.reportContent("THREAD", threadId, reason);
    window.alert("Thanks — this has been sent to the moderation team.");
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-heading">Thread not available</h1>
        <Link
          href="/community"
          className="mt-4 inline-block text-sm text-primary-600 hover:underline"
        >
          Back to community
        </Link>
      </main>
    );
  }

  if (!thread) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  const isAuthor = user?.id === thread.author.id;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-4 text-sm text-neutral-500">
        <Link href={`/community/boards/${thread.boardId}`} className="hover:underline">
          {thread.boardTitle}
        </Link>{" "}
        · <span className="text-neutral-800">{thread.title}</span>
      </nav>

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

      <h1 className="mt-2 text-heading">{thread.title}</h1>
      <p className="mt-1 text-xs text-neutral-500">
        by {thread.author.firstName ?? thread.author.email} · {thread.viewCount} views
      </p>
      <p className="mt-4 whitespace-pre-wrap text-body">{thread.body}</p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <button onClick={() => void handleToggleLike()} className="hover:underline">
          {thread.isLikedByViewer ? "Liked" : "Like"} ({thread.likeCount})
        </button>
        <button onClick={() => void handleToggleBookmark()} className="hover:underline">
          {thread.isBookmarkedByViewer ? "Bookmarked" : "Bookmark"}
        </button>
        <button onClick={() => void handleToggleFollow()} className="hover:underline">
          {thread.isFollowedByViewer ? "Following" : "Follow"}
        </button>
        <button onClick={() => void handleReport()} className="text-neutral-500 hover:underline">
          Report
        </button>
        {isAuthor ? (
          <button onClick={() => void handleToggleStatus()} className="hover:underline">
            {thread.status === "OPEN" ? "Close thread" : "Reopen thread"}
          </button>
        ) : null}
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold text-neutral-700">
          {replies.length} repl{replies.length === 1 ? "y" : "ies"}
        </h2>

        <div className="mt-4 space-y-4">
          {replies.map((reply) => (
            <ReplyNode
              key={reply.id}
              reply={reply}
              threadId={threadId}
              isQuestion={thread.type === "QUESTION"}
              isThreadAuthor={isAuthor}
              onReplied={loadReplies}
              onAccept={(replyId) => void handleAccept(replyId)}
            />
          ))}
        </div>

        {!thread.isLocked ? (
          <div className="mt-6 flex gap-2">
            <textarea
              className="min-h-20 w-full rounded-md border border-neutral-300 p-3 text-sm"
              value={newReplyBody}
              onChange={(e) => setNewReplyBody(e.target.value)}
              placeholder="Write a reply…"
            />
            <Button onClick={() => void handlePostReply()}>Post</Button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-neutral-500">This thread is locked to new replies.</p>
        )}
      </div>
    </main>
  );
}

export default function ThreadDetailPage() {
  return (
    <RequireAuth>
      <ThreadDetailContent />
    </RequireAuth>
  );
}
