"use client";

import * as React from "react";
import { HandHeart, MessageCircle, Trash2 } from "lucide-react";
import type { QuestionDoubtView } from "@examora/types";
import { Button, cn } from "@examora/ui";
import { Chip } from "@/components/ui/chip";
import { useStudentApi } from "@/lib/student-api";

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/** Doubts and explanations students post on a question, with replies and claps. */
export function DoubtsThread({ questionId }: { questionId: string }) {
  const api = useStudentApi();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const [doubts, setDoubts] = React.useState<QuestionDoubtView[] | null>(null);
  const [draft, setDraft] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    apiRef.current
      .doubts(questionId)
      .then(setDoubts)
      .catch(() => setDoubts([]));
  }, [questionId]);

  React.useEffect(() => {
    setDoubts(null);
    setDraft("");
    setReplyTo(null);
    load();
  }, [load]);

  async function post(body: string, parentId?: string) {
    setBusy(true);
    setError(null);
    try {
      await api.postDoubt(questionId, body, parentId);
      setDraft("");
      setReply("");
      setReplyTo(null);
      load();
    } catch {
      setError("Couldn't post. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const textarea =
    "min-h-16 w-full rounded-md border border-neutral-300 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <section
      aria-labelledby={`doubts-${questionId}`}
      className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800"
    >
      <h3
        id={`doubts-${questionId}`}
        className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-white/90"
      >
        <MessageCircle size={16} aria-hidden="true" /> Doubts &amp; explanations
      </h3>
      {doubts === null ? (
        <p className="mt-3 text-sm text-neutral-500">Loading…</p>
      ) : doubts.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          No one has posted yet. Ask a doubt or explain your approach.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {doubts.map((d) => (
            <li key={d.id} className="rounded-md bg-neutral-50 p-3 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span className="font-medium text-neutral-800 dark:text-white/90">
                  {d.authorName}
                </span>
                <span>{timeAgo(d.createdAt)}</span>
                {d.popular ? <Chip tone="success">Popular</Chip> : null}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">
                {d.body}
              </p>
              <div className="mt-2 flex items-center gap-4 text-xs">
                <button
                  type="button"
                  aria-pressed={d.clappedByMe}
                  onClick={async () => {
                    await api.clap(d.id).catch(() => undefined);
                    load();
                  }}
                  className={cn(
                    "flex items-center gap-1 hover:underline",
                    d.clappedByMe
                      ? "font-medium text-primary-700 dark:text-primary-300"
                      : "text-neutral-600 dark:text-neutral-400",
                  )}
                >
                  <HandHeart size={14} aria-hidden="true" /> Helpful
                  {d.claps > 0 ? ` · ${d.claps}` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setReplyTo(replyTo === d.id ? null : d.id)}
                  className="text-neutral-600 hover:underline dark:text-neutral-400"
                >
                  Reply
                </button>
                {d.isMine ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await api.deleteDoubt(d.id).catch(() => undefined);
                      load();
                    }}
                    className="flex items-center gap-1 text-neutral-500 hover:text-danger-600"
                  >
                    <Trash2 size={13} aria-hidden="true" /> Delete
                  </button>
                ) : null}
              </div>
              {d.replies.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2 border-l-2 border-neutral-200 pl-3 dark:border-neutral-700">
                  {d.replies.map((r) => (
                    <li key={r.id}>
                      <div className="text-xs text-neutral-500">
                        <span className="font-medium text-neutral-800 dark:text-white/90">
                          {r.authorName}
                        </span>{" "}
                        · {timeAgo(r.createdAt)}
                      </div>
                      <p className="whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">
                        {r.body}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {replyTo === d.id ? (
                <div className="mt-3 flex flex-col gap-2">
                  <textarea
                    aria-label="Your reply"
                    className={textarea}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <div>
                    <Button
                      size="sm"
                      disabled={busy || reply.trim().length < 2}
                      onClick={() => void post(reply.trim(), d.id)}
                    >
                      Post reply
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <label
          htmlFor={`doubt-${questionId}`}
          className="text-sm text-neutral-600 dark:text-neutral-400"
        >
          Ask a doubt or share an explanation
        </label>
        <textarea
          id={`doubt-${questionId}`}
          className={textarea}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        {error ? (
          <p role="alert" className="text-sm text-danger-600">
            {error}
          </p>
        ) : null}
        <div>
          <Button
            size="sm"
            disabled={busy || draft.trim().length < 2}
            onClick={() => void post(draft.trim())}
          >
            Post
          </Button>
        </div>
      </div>
    </section>
  );
}
