"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@examora/auth-client";
import { Eye, Flag, Lock, Pencil, Trash2, Unlock } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { authorDisplayName, timeAgo } from "@/lib/format";
import { Avatar } from "@/components/community/avatar";
import { ThreadBadges } from "@/components/community/thread-badges";
import { ReactionBar } from "@/components/community/reaction-bar";
import { ReplyComposer } from "@/components/community/reply-composer";
import { countReplies, ReplyTree } from "@/components/community/reply-tree";
import { ReportDialog } from "@/components/community/report-dialog";
import { AttachmentUploadZone } from "@/components/community/attachment-upload-zone";
import { AttachmentList } from "@/components/community/attachment-list";
import { useAttachments } from "@/components/community/use-attachments";
import { useThreadDetail } from "@/components/community/use-thread-detail";

function ThreadDetailContent() {
  const { id: threadId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const data = useThreadDetail(threadId);
  const attachments = useAttachments("THREAD", data.thread?.id ?? null);

  const [editing, setEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");
  const [editBody, setEditBody] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [reportTarget, setReportTarget] = React.useState<
    { type: "THREAD" } | { type: "REPLY"; replyId: string } | null
  >(null);

  React.useEffect(() => {
    if (data.thread) {
      setEditTitle(data.thread.title);
      setEditBody(data.thread.body);
    }
  }, [data.thread]);

  if (data.loadState === "not-found") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <EmptyState
          heading="Discussion not available"
          body="This thread may have been removed, or you don't have access to it."
          actionLabel="Back to community"
          actionHref="/community"
        />
      </main>
    );
  }

  if (data.loadState === "loading" || !data.thread) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  const thread = data.thread;
  const isAuthor = user?.id === thread.author.id;
  // The backend blocks new replies (RepliesService.create) when EITHER the
  // moderator-only isLocked flag is set OR the author-driven status is
  // CLOSED — two independent booleans (ADR-0017), both must gate the composer.
  const repliesDisabled = thread.isLocked || thread.status === "CLOSED";
  const replyCount = countReplies(data.replies);

  async function handleSaveEdit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!editTitle.trim() || !editBody.trim()) return;
    setSavingEdit(true);
    try {
      await data.updateThread({ title: editTitle.trim(), body: editBody.trim() });
      setEditing(false);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(): Promise<void> {
    await data.deleteThread();
    router.push(`/community/boards/${thread.boardId}`);
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
        <Link href="/community" className="hover:text-primary-600 hover:underline">
          Community
        </Link>{" "}
        /{" "}
        <Link
          href={`/community/boards/${thread.boardId}`}
          className="hover:text-primary-600 hover:underline"
        >
          {thread.boardTitle}
        </Link>
      </nav>

      <div>
        <ThreadBadges thread={thread} />

        {editing ? (
          <form onSubmit={(e) => void handleSaveEdit(e)} className="mt-3 flex flex-col gap-3">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={200}
              required
              className="h-11 w-full rounded-md border border-neutral-200 px-3 font-heading text-xl font-bold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            />
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              maxLength={20000}
              required
              className="min-h-40 w-full rounded-md border border-neutral-200 p-3 text-sm text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex h-10 items-center rounded-md px-4 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="flex h-10 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <h1 className="mt-3 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
              {thread.title}
            </h1>
            <div className="mt-3 flex items-center gap-3">
              <Avatar author={thread.author} size="md" />
              <div className="min-w-0 text-sm">
                <Link
                  href={`/community/profile/${thread.author.id}`}
                  className="font-medium text-neutral-900 hover:underline"
                >
                  {authorDisplayName(thread.author)}
                </Link>
                <p className="text-xs text-neutral-400">
                  {timeAgo(thread.createdAt)} ·{" "}
                  <span className="inline-flex items-center gap-1 align-middle">
                    <Eye size={12} strokeWidth={1.75} aria-hidden="true" />
                    {thread.viewCount} views
                  </span>
                </p>
              </div>
            </div>

            <p className="mt-5 whitespace-pre-wrap text-base leading-relaxed text-neutral-800">
              {thread.body}
            </p>

            {attachments.attachments.length > 0 || (isAuthor && !thread.isLocked) ? (
              <div className="mt-5">
                <AttachmentList
                  attachments={attachments.attachments}
                  canModify={isAuthor}
                  onRemove={attachments.removeAttachment}
                  onDownload={(id) => void attachments.downloadAttachment(id)}
                />
                {isAuthor && !thread.isLocked ? (
                  <div className="mt-2">
                    <AttachmentUploadZone onFilesAccepted={attachments.uploadFiles} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      <ReactionBar
        thread={thread}
        onToggleLike={() => void data.toggleThreadLike()}
        onToggleBookmark={() => void data.toggleBookmark()}
        onToggleFollow={() => void data.toggleFollow()}
      />

      <div className="flex flex-wrap items-center gap-4 border-y border-neutral-100 py-3 text-xs font-medium text-neutral-500">
        {isAuthor && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 hover:text-primary-600"
          >
            <Pencil size={13} strokeWidth={1.75} aria-hidden="true" />
            Edit
          </button>
        ) : null}
        {isAuthor ? (
          <button
            type="button"
            onClick={() => void data.toggleStatus()}
            className="flex items-center gap-1.5 hover:text-primary-600"
          >
            {thread.status === "OPEN" ? (
              <>
                <Lock size={13} strokeWidth={1.75} aria-hidden="true" />
                Close thread
              </>
            ) : (
              <>
                <Unlock size={13} strokeWidth={1.75} aria-hidden="true" />
                Reopen thread
              </>
            )}
          </button>
        ) : null}
        {isAuthor ? (
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="flex items-center gap-1.5 hover:text-danger-600"
          >
            <Trash2 size={13} strokeWidth={1.75} aria-hidden="true" />
            Delete
          </button>
        ) : null}
        {!isAuthor ? (
          <button
            type="button"
            onClick={() => setReportTarget({ type: "THREAD" })}
            className="ml-auto flex items-center gap-1.5 text-neutral-400 hover:text-danger-600"
          >
            <Flag size={13} strokeWidth={1.75} aria-hidden="true" />
            Report
          </button>
        ) : null}
      </div>

      <section aria-labelledby="replies-heading">
        <h2 id="replies-heading" className="font-heading text-lg font-semibold text-neutral-900">
          {replyCount} {replyCount === 1 ? "reply" : "replies"}
        </h2>

        <div className="mt-4">
          {data.replies.length === 0 ? (
            <Card density="compact">
              <p className="text-sm text-neutral-500">No replies yet — be the first to respond.</p>
            </Card>
          ) : (
            <ReplyTree
              replies={data.replies}
              actions={{
                isQuestion: thread.type === "QUESTION",
                isThreadAuthor: isAuthor,
                threadLocked: repliesDisabled,
                onReply: data.postNestedReply,
                onToggleLike: data.toggleReplyLike,
                onAccept: data.acceptAnswer,
                onUnaccept: data.unacceptAnswer,
                onReport: (replyId) => setReportTarget({ type: "REPLY", replyId }),
              }}
            />
          )}
        </div>

        {!repliesDisabled ? (
          <div className="mt-6">
            <ReplyComposer submitting={data.postingReply} onSubmit={data.postTopLevelReply} />
          </div>
        ) : (
          <p className="mt-6 text-sm text-neutral-500">
            {thread.status === "CLOSED"
              ? "This thread is closed to new replies."
              : "This thread is locked to new replies."}
          </p>
        )}
      </section>

      <ReportDialog
        open={reportTarget !== null}
        targetLabel={reportTarget?.type === "REPLY" ? "reply" : "thread"}
        onClose={() => setReportTarget(null)}
        onSubmit={async (reason) => {
          if (!reportTarget) return;
          if (reportTarget.type === "THREAD") await data.reportThread(reason);
          else await data.reportReply(reportTarget.replyId, reason);
        }}
      />
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
