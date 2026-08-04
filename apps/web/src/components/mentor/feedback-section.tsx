"use client";

import * as React from "react";
import { MessageSquare } from "lucide-react";
import type { MentorFeedback } from "@examora/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

/** Student-visible feedback — create + list only, matching the backend exactly (no update/delete endpoint exists for MentorFeedback). Shown as a timeline, newest first. */
export function FeedbackSection({
  feedback,
  onCreate,
}: {
  feedback: MentorFeedback[];
  onCreate: (body: string) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await onCreate(draft.trim());
      setDraft("");
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...feedback].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section aria-labelledby="feedback-heading">
      <h2 id="feedback-heading" className="font-heading text-lg font-semibold text-neutral-900">
        Feedback Timeline
      </h2>
      <Card className="mt-3">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label htmlFor="new-feedback" className="sr-only">
            Share feedback with this student
          </label>
          <textarea
            id="new-feedback"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share feedback — the student will see this"
            className="min-h-20 w-full rounded-md border border-neutral-200 p-3 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          />
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            className="flex h-9 w-fit items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
          >
            {saving ? "Sharing…" : "Share feedback"}
          </button>
        </form>

        <div className="mt-4 border-t border-neutral-100 pt-4">
          {sorted.length === 0 ? (
            <EmptyState icon={MessageSquare} heading="No feedback shared yet" />
          ) : (
            <ul className="flex flex-col gap-3">
              {sorted.map((f) => (
                <li key={f.id} className="rounded-md bg-neutral-50 p-3">
                  <p className="whitespace-pre-wrap text-sm text-neutral-700">{f.body}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {new Date(f.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </section>
  );
}
