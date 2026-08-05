"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ForumBoard, ForumCategory, ThreadType } from "@examora/types";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useCommunityApi } from "@/lib/community-api";
import { BoardSelect } from "./board-select";

/**
 * Shared by /community/new (no preselected board) and
 * /community/boards/[boardId]/new (board locked in from the URL). Body is a
 * plain `String` column with no markdown/rich-text contract documented on
 * the schema (unlike Lesson.body) — so this is a plain-text composer with an
 * honest "how it will look" preview, not a fabricated rich-text editor.
 * Attachments aren't offered here: the API only allows attaching files to a
 * target the actor already owns (CommunityAttachmentsService.assertOwnsTarget),
 * so a thread must exist first — the redirect after Publish lands on the new
 * thread's own page, where attachments can be added immediately.
 */
export function CreateThreadForm({ initialBoardId }: { initialBoardId?: string }) {
  const router = useRouter();
  const api = useCommunityApi();

  const [categories, setCategories] = React.useState<ForumCategory[]>([]);
  const [boardsByCategory, setBoardsByCategory] = React.useState<Record<string, ForumBoard[]>>({});
  const [loadingBoards, setLoadingBoards] = React.useState(true);

  const [boardId, setBoardId] = React.useState(initialBoardId ?? "");
  const [type, setType] = React.useState<ThreadType>("DISCUSSION");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [mode, setMode] = React.useState<"write" | "preview">("write");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    Promise.all([api.listCategories(), api.listBoards()])
      .then(([categoriesRes, boardsRes]) => {
        setCategories(categoriesRes.items);
        // Grouped client-side from one request — see useCommunityHome for why
        // per-category listBoards() calls (an N+1 pattern) are avoided.
        const grouped: Record<string, ForumBoard[]> = {};
        for (const board of boardsRes.items) {
          (grouped[board.categoryId] ??= []).push(board);
        }
        setBoardsByCategory(grouped);
      })
      .catch(() => undefined)
      .finally(() => setLoadingBoards(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!boardId || !title.trim() || !body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const thread = await api.createThread({
        boardId,
        type,
        title: title.trim(),
        body: body.trim(),
      });
      router.push(`/community/threads/${thread.id}`);
    } catch {
      setError("Could not publish this thread. Check your input and try again.");
      setSubmitting(false);
    }
  }

  const canPublish = Boolean(boardId) && title.trim().length > 0 && body.trim().length > 0;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
        <BoardSelect
          id="thread-board"
          categories={categories}
          boardsByCategory={boardsByCategory}
          value={boardId}
          onChange={setBoardId}
          disabled={loadingBoards}
        />
        <div>
          <span className="mb-1.5 block text-xs font-medium text-neutral-500">Type</span>
          <SegmentedControl
            aria-label="Thread type"
            value={type}
            onChange={setType}
            options={[
              { value: "DISCUSSION", label: "Discussion" },
              { value: "QUESTION", label: "Question" },
            ]}
          />
        </div>
      </div>

      <div>
        <label htmlFor="thread-title" className="mb-1.5 block text-xs font-medium text-neutral-500">
          Title
        </label>
        <input
          id="thread-title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            type === "QUESTION"
              ? "What's your question, in one sentence?"
              : "Give your discussion a clear title"
          }
          className="h-11 w-full rounded-md border border-neutral-200 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="thread-body" className="text-xs font-medium text-neutral-500">
            {type === "QUESTION" ? "Describe your question" : "What's on your mind?"}
          </label>
          <div className="inline-flex rounded-full bg-neutral-100 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMode("write")}
              className={`rounded-full px-2.5 py-1 font-medium ${mode === "write" ? "bg-white text-neutral-900 shadow-soft" : "text-neutral-500"}`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setMode("preview")}
              className={`rounded-full px-2.5 py-1 font-medium ${mode === "preview" ? "bg-white text-neutral-900 shadow-soft" : "text-neutral-500"}`}
            >
              Preview
            </button>
          </div>
        </div>
        {mode === "write" ? (
          <textarea
            id="thread-body"
            required
            maxLength={20000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add details — the more context you give, the easier it is for others to help."
            className="min-h-48 w-full rounded-md border border-neutral-200 p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          />
        ) : (
          <Card className="min-h-48">
            {body.trim() ? (
              <p className="whitespace-pre-wrap text-sm text-neutral-800">{body}</p>
            ) : (
              <p className="text-sm text-neutral-400">Nothing to preview yet.</p>
            )}
          </Card>
        )}
      </div>

      {error ? <p className="text-sm text-danger-600">{error}</p> : null}

      <div className="flex items-center justify-end gap-3">
        <p className="mr-auto text-xs text-neutral-400">
          You can attach files once this is published.
        </p>
        <button
          type="submit"
          disabled={submitting || !canPublish}
          className="flex h-11 items-center justify-center rounded-md bg-primary-600 px-6 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
        >
          {submitting ? "Publishing…" : "Publish"}
        </button>
      </div>
    </form>
  );
}
