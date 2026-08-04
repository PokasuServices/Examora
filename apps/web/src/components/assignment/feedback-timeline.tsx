"use client";

import * as React from "react";
import { useAuth } from "@examora/auth-client";
import { MessageSquare } from "lucide-react";
import type { AssignmentComment, AssignmentReview } from "@examora/types";

interface TimelineEntry {
  id: string;
  kind: "comment" | "review";
  authorLabel: string;
  body: string;
  at: string;
  isSelf: boolean;
}

/**
 * Merges two real, independent, submission-scoped feedback sources into one
 * chronological view: AssignmentReview.overallComment (structured, one-time,
 * published-dated) and the AssignmentComment thread (freeform, ongoing).
 * AssignmentComment has no author-role field — "Reviewer" is a safe label
 * because findAccessibleOrThrow limits this thread to exactly the owning
 * student and the assigned reviewer, so "not me" can only mean the reviewer.
 */
export function FeedbackTimeline({
  comments,
  review,
  onPostComment,
  posting,
}: {
  comments: AssignmentComment[];
  review: AssignmentReview | null;
  onPostComment: (body: string) => void;
  posting: boolean;
}) {
  const { user } = useAuth();
  const [draft, setDraft] = React.useState("");

  const entries: TimelineEntry[] = [
    ...(review?.overallComment && review.publishedAt
      ? [
          {
            id: `review-${review.id}`,
            kind: "review" as const,
            authorLabel: "Review feedback",
            body: review.overallComment,
            at: review.publishedAt,
            isSelf: false,
          },
        ]
      : []),
    ...comments.map((c) => ({
      id: c.id,
      kind: "comment" as const,
      authorLabel: c.authorId === user?.id ? "You" : "Reviewer",
      body: c.body,
      at: c.createdAt,
      isSelf: c.authorId === user?.id,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onPostComment(draft.trim());
    setDraft("");
  }

  return (
    <section aria-labelledby="feedback-timeline-heading">
      <h2
        id="feedback-timeline-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Feedback
      </h2>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">No feedback yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-600"
              >
                <MessageSquare size={14} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 rounded-md bg-neutral-50 px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-neutral-800">{entry.authorLabel}</span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {new Date(entry.at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-700">{entry.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <label htmlFor="comment-input" className="sr-only">
          Add a comment
        </label>
        <input
          id="comment-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment…"
          className="h-10 flex-1 rounded-md border border-neutral-200 px-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        />
        <button
          type="submit"
          disabled={posting || !draft.trim()}
          className="flex h-10 shrink-0 items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
        >
          Post
        </button>
      </form>
    </section>
  );
}
