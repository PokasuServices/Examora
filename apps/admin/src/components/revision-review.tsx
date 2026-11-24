"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { SketchRevisionQueueItem } from "@examora/types";
import { Button, FieldError, cn } from "@examora/ui";
import { Brush } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { adminMediaUrl } from "@/lib/media-api";
import { useStudentAdminApi } from "@/lib/student-admin-api";

/** Feedback on one revision: 1–5 per factor plus a comment (doesn't change the test score). */
function RevisionForm({ item, onDone }: { item: SketchRevisionQueueItem; onDone: () => void }) {
  const api = useStudentAdminApi();
  const [scores, setScores] = React.useState<Record<string, number>>(item.myScores ?? {});
  const [comment, setComment] = React.useState(item.myComment ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const url = adminMediaUrl(item.imageRef);
  const complete = item.factors.every((f) => scores[f.title] !== undefined);

  return (
    <Card>
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div>
          {url ? (
            // Plain <img>: media URLs redirect to short-lived storage URLs.
            <img
              src={url}
              alt={`${item.label} by ${item.studentName}`}
              className="w-full rounded border border-neutral-200 object-contain dark:border-neutral-800"
            />
          ) : null}
          <p className="mt-2 text-xs text-neutral-500">
            Not showing? It appears once the virus scan finishes.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-800 dark:text-white/90">
              {item.studentName} <Chip tone="primary">{item.label}</Chip>
            </p>
            <p className="mt-1 line-clamp-3 text-xs text-neutral-500">{item.questionText}</p>
            {item.description ? (
              <p className="mt-2 rounded bg-neutral-50 px-3 py-2 text-sm italic text-neutral-700 dark:bg-white/[0.03] dark:text-neutral-300">
                &ldquo;{item.description}&rdquo;
              </p>
            ) : null}
          </div>
          <ol className="flex flex-col gap-2">
            {item.factors.map((f) => (
              <li key={f.title} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">
                  {f.title}
                  {f.description ? (
                    <span className="block text-xs text-neutral-500">{f.description}</span>
                  ) : null}
                </span>
                <div role="radiogroup" aria-label={f.title} className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={scores[f.title] === n}
                      onClick={() => setScores((p) => ({ ...p, [f.title]: n }))}
                      className={cn(
                        "h-8 w-8 rounded text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                        scores[f.title] === n
                          ? "bg-primary-600 text-white"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <label
            htmlFor={`rev-comment-${item.versionId}`}
            className="text-sm text-neutral-700 dark:text-neutral-300"
          >
            Feedback for the student
          </label>
          <textarea
            id={`rev-comment-${item.versionId}`}
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <FieldError>{error}</FieldError>
          <div>
            <Button
              disabled={!complete || saving}
              onClick={async () => {
                setSaving(true);
                setError(null);
                try {
                  await api.rateRevision(item.versionId, {
                    scores,
                    comment: comment.trim() || null,
                  });
                  onDone();
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : "Couldn't save");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : item.myScores ? "Update feedback" : "Save feedback"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Revisions students uploaded after a test, waiting for (or with) reviewer feedback. */
export function RevisionReview() {
  const api = useStudentAdminApi();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const [status, setStatus] = React.useState<"pending" | "reviewed">("pending");
  const [items, setItems] = React.useState<SketchRevisionQueueItem[] | null>(null);
  const [error, setError] = React.useState(false);
  const load = React.useCallback(() => {
    setError(false);
    setItems(null);
    apiRef.current
      .revisions(status)
      .then(setItems)
      .catch(() => setError(true));
  }, [status]);
  React.useEffect(() => load(), [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "reviewed"] as const).map((s) => (
          <Button
            key={s}
            variant={status === s ? "primary" : "outline"}
            size="sm"
            onClick={() => setStatus(s)}
          >
            {s === "pending" ? "Waiting for feedback" : "With feedback"}
          </Button>
        ))}
        {items ? <Chip tone="neutral">{items.length}</Chip> : null}
        <p className="w-full text-xs text-neutral-500">
          Revisions are for learning: your feedback shows to the student but doesn&rsquo;t change
          their test score.
        </p>
      </div>
      {error ? (
        <Card>
          <RetryInline message="Couldn't load revisions" onRetry={load} />
        </Card>
      ) : items === null ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Brush}
            heading={
              status === "pending" ? "No revisions waiting" : "No revisions with feedback yet"
            }
          />
        </Card>
      ) : (
        items.map((i) => <RevisionForm key={i.versionId} item={i} onDone={load} />)
      )}
    </div>
  );
}
