"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type {
  AssignmentSubmissionStatus,
  ReviewDecision,
  ReviewerSubmissionView,
} from "@examora/types";
import { REVIEW_DECISIONS } from "@examora/types";
import { Button, FieldError, Input } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { useAssignmentAdminApi } from "@/lib/assignment-api";

interface ScoreInput {
  marksAwarded: string;
  comment: string;
}

const STATUS_TONE: Record<AssignmentSubmissionStatus, ChipTone> = {
  DRAFT: "neutral",
  SUBMITTED: "primary",
  UNDER_REVIEW: "warning",
  REVISION_REQUESTED: "danger",
  APPROVED: "success",
};

const SCAN_TONE: Record<string, ChipTone> = {
  PENDING: "warning",
  CLEAN: "success",
  INFECTED: "danger",
  FAILED: "danger",
};

function ReviewWorkspaceContent() {
  const { id } = useParams<{ id: string }>();
  const api = useAssignmentAdminApi();
  const [loadStatus, setLoadStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [submission, setSubmission] = React.useState<ReviewerSubmissionView | null>(null);
  const [scores, setScores] = React.useState<Record<string, ScoreInput>>({});
  const [overallComment, setOverallComment] = React.useState("");
  const [decision, setDecision] = React.useState<ReviewDecision>("APPROVED");
  const [comment, setComment] = React.useState("");
  const [postingComment, setPostingComment] = React.useState(false);
  const [confirmPublish, setConfirmPublish] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    setLoadStatus("loading");
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
        setLoadStatus("ready");
      })
      .catch(() => setLoadStatus("error"));
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

  async function confirmPublishReview(): Promise<void> {
    setError(null);
    setSaving(true);
    try {
      await api.saveDraftReview(id, {
        overallComment: overallComment || undefined,
        scores: buildScorePayload(),
      });
      await api.publishReview(id, decision);
      setConfirmPublish(false);
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
    setPostingComment(true);
    try {
      await api.addComment(id, comment);
      setComment("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add comment");
    } finally {
      setPostingComment(false);
    }
  }

  if (loadStatus === "loading") {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32" />
        <Card>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-4 h-32 w-full" />
        </Card>
      </main>
    );
  }

  if (loadStatus === "error" || !submission) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <RetryInline message="Couldn't load this submission" onRetry={load} />
        </Card>
      </main>
    );
  }

  const isPublished = submission.review?.status === "PUBLISHED";
  const totalAwarded = Object.values(scores).reduce(
    (sum, s) => sum + (Number(s.marksAwarded) || 0),
    0,
  );
  const totalPossible = submission.criteria.reduce((sum, c) => sum + c.maxMarks, 0);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/assignments/reviewer"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Reviewer queue
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-neutral-900">
            {submission.assignmentTitle}
          </h1>
          <Chip tone={STATUS_TONE[submission.status]}>{statusLabel(submission.status)}</Chip>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Version {submission.version}
          {submission.submittedAt
            ? ` · Submitted ${new Date(submission.submittedAt).toLocaleString()}`
            : ""}
        </p>
        {submission.notes ? (
          <p className="mt-2 text-sm text-neutral-700">Notes: {submission.notes}</p>
        ) : null}
      </div>

      <FieldError>{error}</FieldError>

      <Card density="compact">
        <h2 className="font-heading text-base font-semibold text-neutral-900">Files</h2>
        {submission.files.length > 0 ? (
          <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
            {submission.files.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
              >
                <span className="flex items-center gap-2 text-neutral-700">
                  {f.fileName}
                  <span className="text-neutral-400">({(f.sizeBytes / 1024).toFixed(0)} KB)</span>
                  <Chip tone={SCAN_TONE[f.scanStatus] ?? "neutral"}>
                    {statusLabel(f.scanStatus)}
                  </Chip>
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
          <p className="mt-3 text-sm text-neutral-400">No files uploaded.</p>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-base font-semibold text-neutral-900">Rubric scoring</h2>
          <span className="text-sm text-neutral-500">
            {totalAwarded} / {totalPossible} marks
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-neutral-800">
                  {criterion.title}{" "}
                  <span className="font-normal text-neutral-400">
                    (max {criterion.maxMarks} marks)
                  </span>
                </p>
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
                className="mt-2 min-h-16 w-full rounded-md border border-neutral-300 p-2 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
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

        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor="overallComment" className="text-sm font-medium text-neutral-800">
            Overall comment
          </label>
          <textarea
            id="overallComment"
            disabled={isPublished}
            className="min-h-20 w-full rounded-md border border-neutral-300 p-3 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            value={overallComment}
            onChange={(e) => setOverallComment(e.target.value)}
          />
        </div>

        {!isPublished ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Button variant="secondary" disabled={saving} onClick={() => void saveDraft()}>
              {saving ? "Saving…" : "Save draft"}
            </Button>
            <div className="w-56">
              <SelectField
                id="decision"
                label="Decision"
                value={decision}
                options={REVIEW_DECISIONS.map((d) => ({ value: d, label: statusLabel(d) }))}
                onChange={(v) => setDecision(v as ReviewDecision)}
              />
            </div>
            <Button disabled={saving} onClick={() => setConfirmPublish(true)}>
              Publish review
            </Button>
          </div>
        ) : null}
      </Card>

      <Card density="compact">
        <h2 className="font-heading text-base font-semibold text-neutral-900">Comments</h2>
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
          <p className="mt-3 text-sm text-neutral-400">No comments yet.</p>
        )}
        <form onSubmit={(e) => void addComment(e)} className="mt-4 flex items-end gap-3">
          <Input
            placeholder="Add a comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={postingComment || !comment.trim()}>
            {postingComment ? "Posting…" : "Post"}
          </Button>
        </form>
      </Card>

      <ConfirmDialog
        open={confirmPublish}
        title="Publish this review?"
        message={
          <>
            Publishing records a{" "}
            <span className="font-medium text-neutral-800">{statusLabel(decision)}</span> decision
            and makes the scores visible to the student. Scores become read-only afterward.
          </>
        }
        confirmLabel="Publish"
        submitting={saving}
        error={error}
        onConfirm={() => void confirmPublishReview()}
        onCancel={() => setConfirmPublish(false)}
      />
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
