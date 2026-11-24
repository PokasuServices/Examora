"use client";

import * as React from "react";
import { Brush, MessageSquarePlus } from "lucide-react";
import type { SketchReviewQueueItem } from "@examora/types";
import { Button, FieldError, Input, Label, cn } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { RevisionReview } from "@/components/revision-review";
import { SketchPinsDialog } from "@/components/sketch-pins";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { adminMediaUrl } from "@/lib/media-api";
import { useStudentAdminApi } from "@/lib/student-admin-api";

function ReviewForm({ item, onDone }: { item: SketchReviewQueueItem; onDone: () => void }) {
  const api = useStudentAdminApi();
  const [scores, setScores] = React.useState<Record<string, number>>(item.expertScores ?? {});
  const [marks, setMarks] = React.useState(item.marksAwarded?.toString() ?? "");
  const [comment, setComment] = React.useState(item.expertComment ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [pins, setPins] = React.useState(false);
  const url = adminMediaUrl(item.imageRef);
  const complete = item.criteria.every((c) => scores[c] !== undefined) && marks.trim() !== "";

  return (
    <Card>
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div>
          {url ? (
            // Plain <img>: media URLs redirect to short-lived storage URLs.
            <img
              src={url}
              alt="Student sketch"
              className="w-full rounded border border-neutral-200 object-contain dark:border-neutral-800"
            />
          ) : null}
          <p className="mt-2 text-xs text-neutral-500">
            Not showing? It appears once the virus scan finishes.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setPins(true)}>
            <MessageSquarePlus size={14} aria-hidden="true" className="mr-1.5" />
            Comment on spots
          </Button>
          {pins ? (
            <SketchPinsDialog
              title={`Sketch by ${item.studentEmail}`}
              imageRef={item.imageRef}
              imageAlt="Student sketch"
              load={() => api.sketchComments(item.answerId)}
              add={(c) => api.addSketchComment(item.answerId, c)}
              remove={(id) => api.deleteSketchComment(id)}
              onClose={() => setPins(false)}
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">{item.questionText}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {item.studentEmail} · {item.quizTitle}
              {item.submittedAt ? ` · ${new Date(item.submittedAt).toLocaleString()}` : ""}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th scope="col" className="py-1 font-medium">
                  Criterion
                </th>
                <th scope="col" className="py-1 font-medium">
                  Student&rsquo;s own
                </th>
                <th scope="col" className="py-1 font-medium">
                  Your rating
                </th>
              </tr>
            </thead>
            <tbody>
              {item.criteria.map((c) => (
                <tr key={c}>
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                    {c}
                  </th>
                  <td className="py-1.5 tabular-nums">{item.selfScores?.[c] ?? "—"}</td>
                  <td className="py-1.5">
                    <div role="radiogroup" aria-label={`Rate ${c}`} className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={scores[c] === n}
                          onClick={() => setScores((p) => ({ ...p, [c]: n }))}
                          className={cn(
                            "h-7 w-7 rounded text-xs font-medium",
                            scores[c] === n
                              ? "bg-primary-600 text-white"
                              : "bg-neutral-100 text-neutral-700 dark:bg-white/5 dark:text-neutral-300",
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`marks-${item.answerId}`}>Marks (of {item.marks})</Label>
              <Input
                id={`marks-${item.answerId}`}
                inputMode="decimal"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`comment-${item.answerId}`}>Feedback for the student</Label>
              <textarea
                id={`comment-${item.answerId}`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-16 rounded-md border border-neutral-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
          </div>
          <FieldError>{error}</FieldError>
          <div>
            <Button
              disabled={!complete || saving}
              onClick={async () => {
                const m = Number(marks);
                if (!Number.isFinite(m) || m < 0 || m > item.marks) {
                  setError(`Marks must be between 0 and ${item.marks}.`);
                  return;
                }
                setSaving(true);
                setError(null);
                try {
                  await api.reviewSketch(item.answerId, {
                    scores,
                    marks: m,
                    comment: comment.trim() || undefined,
                  });
                  onDone();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Couldn't save the review");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : item.marksAwarded !== null ? "Update marks" : "Save marks"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SketchesContent() {
  const api = useStudentAdminApi();
  const [view, setView] = React.useState<"tests" | "revisions">("tests");
  const [status, setStatus] = React.useState<"pending" | "reviewed">("pending");
  const [items, setItems] = React.useState<SketchReviewQueueItem[] | null>(null);
  const [error, setError] = React.useState(false);
  const load = React.useCallback(() => {
    setError(false);
    setItems(null);
    api
      .sketches(status)
      .then(setItems)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  React.useEffect(() => load(), [load]);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Sketch review"
        subtitle="Mark test uploads (the test score updates) and give feedback on the revisions students upload afterwards."
      />
      <div
        role="tablist"
        aria-label="What to review"
        className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800"
      >
        {(["tests", "revisions"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium " +
              (view === v
                ? "border-primary-600 text-primary-700 dark:text-primary-300"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400")
            }
          >
            {v === "tests" ? "Test uploads (marks)" : "Revisions (feedback)"}
          </button>
        ))}
      </div>
      {view === "revisions" ? (
        <RevisionReview />
      ) : (
        <>
          <div className="flex gap-2">
            {(["pending", "reviewed"] as const).map((s) => (
              <Button
                key={s}
                variant={status === s ? "primary" : "outline"}
                size="sm"
                onClick={() => setStatus(s)}
              >
                {s === "pending" ? "Waiting for marks" : "Marked"}
              </Button>
            ))}
            {items ? <Chip tone="neutral">{items.length}</Chip> : null}
          </div>
          {error ? (
            <Card>
              <RetryInline message="Couldn't load sketches" onRetry={load} />
            </Card>
          ) : items === null ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : items.length === 0 ? (
            <Card>
              <EmptyState
                icon={Brush}
                heading={status === "pending" ? "Nothing to mark" : "No marked sketches yet"}
              />
            </Card>
          ) : (
            items.map((i) => <ReviewForm key={i.answerId} item={i} onDone={load} />)
          )}
        </>
      )}
    </main>
  );
}

export default function SketchReviewPage() {
  return (
    <RequirePermission permission="assignment:review">
      <SketchesContent />
    </RequirePermission>
  );
}
