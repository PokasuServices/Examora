"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@examora/auth-client";
import type { ReviewDecision, ReviewerSubmissionView } from "@examora/types";
import { REVIEW_DECISIONS } from "@examora/types";
import { Button, FieldError, Input } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { useAssignmentAdminApi } from "@/lib/assignment-api";

interface ScoreInput {
  marksAwarded: string;
  comment: string;
}

function ReviewWorkspaceContent() {
  const { id } = useParams<{ id: string }>();
  const api = useAssignmentAdminApi();
  const [submission, setSubmission] = React.useState<ReviewerSubmissionView | null>(null);
  const [scores, setScores] = React.useState<Record<string, ScoreInput>>({});
  const [overallComment, setOverallComment] = React.useState("");
  const [decision, setDecision] = React.useState<ReviewDecision>("APPROVED");
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .getReviewSubmission(id)
      .then((s) => {
        setSubmission(s);
        setOverallComment(s.review?.overallComment ?? "");
        const initial: Record<string, ScoreInput> = {};
        for (const criterion of s.criteria) {
          const existing = s.review?.scores.find((sc) => sc.criterionId === criterion.id);
          initial[criterion.id] = {
            marksAwarded: existing ? String(existing.marksAwarded) : "0",
            comment: existing?.comment ?? "",
          };
        }
        setScores(initial);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  function buildScorePayload() {
    return Object.entries(scores).map(([criterionId, input]) => ({
      criterionId,
      marksAwarded: Number(input.marksAwarded),
      comment: input.comment || undefined,
    }));
  }

  async function saveDraft(): Promise<void> {
    setError(null);
    setSaving(true);
    try {
      await api.saveDraftReview(id, {
        overallComment: overallComment || undefined,
        scores: buildScorePayload(),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save draft");
    } finally {
      setSaving(false);
    }
  }

  async function publish(): Promise<void> {
    setError(null);
    setSaving(true);
    try {
      await api.saveDraftReview(id, {
        overallComment: overallComment || undefined,
        scores: buildScorePayload(),
      });
      await api.publishReview(id, decision);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not publish review");
    } finally {
      setSaving(false);
    }
  }

  async function download(fileId: string): Promise<void> {
    setError(null);
    try {
      const { url } = await api.getDownloadUrl(id, fileId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "File is not downloadable yet");
    }
  }

  async function addComment(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!comment.trim()) return;
    setError(null);
    try {
      await api.addComment(id, comment);
      setComment("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add comment");
    }
  }

  if (!submission) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
        <FieldError>{error}</FieldError>
      </main>
    );
  }

  const isPublished = submission.review?.status === "PUBLISHED";
  const totalAwarded = Object.values(scores).reduce(
    (sum, s) => sum + (Number(s.marksAwarded) || 0),
    0,
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/assignments/reviewer" className="hover:underline">
          Reviewer queue
        </Link>{" "}
        · <span className="text-neutral-800">{submission.assignmentTitle}</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-heading">{submission.assignmentTitle}</h1>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm">{submission.status}</span>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        Version {submission.version}
        {submission.submittedAt
          ? ` · Submitted ${new Date(submission.submittedAt).toLocaleString()}`
          : ""}
      </p>
      {submission.notes ? (
        <p className="mt-2 text-sm text-neutral-700">Notes: {submission.notes}</p>
      ) : null}
      <FieldError>{error}</FieldError>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Files</h2>
        {submission.files.length > 0 ? (
          <ul className="mt-3 divide-y divide-neutral-100">
            {submission.files.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {f.fileName}{" "}
                  <span className="text-neutral-400">
                    ({(f.sizeBytes / 1024).toFixed(0)} KB · {f.scanStatus})
                  </span>
                </span>
                <Button
                  variant="ghost"
                  disabled={f.scanStatus !== "CLEAN"}
                  onClick={() => void download(f.id)}
                >
                  Download
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No files uploaded.</p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Rubric scoring</h2>
          <span className="text-sm text-neutral-500">
            {totalAwarded} / {submission.criteria.reduce((sum, c) => sum + c.maxMarks, 0)} marks
          </span>
        </div>

        {isPublished ? (
          <p className="mt-2 text-sm text-warning-600">
            This review is already published. Scores are read-only.
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-4">
          {submission.criteria.map((criterion) => (
            <div key={criterion.id} className="rounded-md border border-neutral-100 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-neutral-800">{criterion.title}</p>
                <Input
                  type="number"
                  min={0}
                  max={criterion.maxMarks}
                  step={0.5}
                  disabled={isPublished}
                  value={scores[criterion.id]?.marksAwarded ?? "0"}
                  onChange={(e) =>
                    setScores((prev) => ({
                      ...prev,
                      [criterion.id]: { ...prev[criterion.id]!, marksAwarded: e.target.value },
                    }))
                  }
                  className="w-24"
                />
              </div>
              {criterion.description ? (
                <p className="mt-1 text-xs text-neutral-500">{criterion.description}</p>
              ) : null}
              <textarea
                placeholder="Feedback for this criterion (optional)"
                disabled={isPublished}
                className="mt-2 min-h-16 w-full rounded-md border border-neutral-300 p-2 text-sm"
                value={scores[criterion.id]?.comment ?? ""}
                onChange={(e) =>
                  setScores((prev) => ({
                    ...prev,
                    [criterion.id]: { ...prev[criterion.id]!, comment: e.target.value },
                  }))
                }
              />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label htmlFor="overallComment" className="text-sm font-medium text-neutral-800">
            Overall comment
          </label>
          <textarea
            id="overallComment"
            disabled={isPublished}
            className="mt-1.5 min-h-20 w-full rounded-md border border-neutral-300 p-3 text-sm"
            value={overallComment}
            onChange={(e) => setOverallComment(e.target.value)}
          />
        </div>

        {!isPublished ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Button variant="secondary" disabled={saving} onClick={() => void saveDraft()}>
              Save draft
            </Button>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="decision" className="text-sm font-medium text-neutral-800">
                Decision
              </label>
              <select
                id="decision"
                className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
                value={decision}
                onChange={(e) => setDecision(e.target.value as ReviewDecision)}
              >
                {REVIEW_DECISIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <Button disabled={saving} onClick={() => void publish()}>
              Publish review
            </Button>
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Comments</h2>
        {submission.comments.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-3">
            {submission.comments.map((c) => (
              <li key={c.id} className="text-sm">
                <p className="font-medium text-neutral-700">{c.authorEmail}</p>
                <p className="text-neutral-600">{c.body}</p>
                <p className="text-xs text-neutral-400">{new Date(c.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No comments yet.</p>
        )}
        <form onSubmit={addComment} className="mt-4 flex items-end gap-3">
          <Input
            placeholder="Add a comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={!comment.trim()}>
            Post
          </Button>
        </form>
      </section>
    </main>
  );
}

export default function ReviewWorkspacePage() {
  return (
    <RequirePermission permission="assignment:review">
      <ReviewWorkspaceContent />
    </RequirePermission>
  );
}
