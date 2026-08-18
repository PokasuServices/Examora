"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApiError, useAuth } from "@examora/auth-client";
import type {
  AdminSubmissionDetail,
  AssignmentSubmissionStatus,
  PaginatedData,
  UserProfile,
} from "@examora/types";
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

const REVIEW_STATUS_TONE: Record<string, ChipTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
};

const DECISION_TONE: Record<string, ChipTone> = {
  APPROVED: "success",
  REVISION_REQUESTED: "danger",
};

function AdminSubmissionDetailContent() {
  const { id } = useParams<{ id: string }>();
  const api = useAssignmentAdminApi();
  const { request } = useAuth();
  const [loadStatus, setLoadStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [submission, setSubmission] = React.useState<AdminSubmissionDetail | null>(null);
  const [reviewers, setReviewers] = React.useState<UserProfile[]>([]);
  const [reviewerId, setReviewerId] = React.useState("");
  const [confirmAssign, setConfirmAssign] = React.useState(false);
  const [assigning, setAssigning] = React.useState(false);
  const [comment, setComment] = React.useState("");
  const [postingComment, setPostingComment] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoadStatus("loading");
    api
      .getSubmissionDetail(id)
      .then((s) => {
        setSubmission(s);
        setLoadStatus("ready");
      })
      .catch(() => setLoadStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    request<PaginatedData<UserProfile>>("/admin/users?pageSize=100", { method: "GET" })
      .then((res) =>
        setReviewers(
          res.items.filter((u) => u.roles.some((r) => r === "MENTOR" || r === "REVIEWER")),
        ),
      )
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmReviewerAssign(): Promise<void> {
    if (!reviewerId) return;
    setError(null);
    setAssigning(true);
    try {
      await api.assignReviewer(id, reviewerId);
      setReviewerId("");
      setConfirmAssign(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign reviewer");
    } finally {
      setAssigning(false);
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

  const chosenReviewerEmail = reviewers.find((r) => r.id === reviewerId)?.email;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/assignments/submissions"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Submissions
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-neutral-900">
            {submission.assignmentTitle}
          </h1>
          <Chip tone={STATUS_TONE[submission.status]}>{statusLabel(submission.status)}</Chip>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {submission.studentEmail} · Version {submission.version}
        </p>
      </div>

      <FieldError>{error}</FieldError>

      <Card density="compact">
        <h2 className="font-heading text-base font-semibold text-neutral-900">Reviewer</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Currently: {submission.reviewerEmail ?? "Unassigned"}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reviewerId) setConfirmAssign(true);
          }}
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          <div className="w-64">
            <SelectField
              id="reviewerId"
              label="Reviewer"
              value={reviewerId}
              options={[
                { value: "", label: "— choose reviewer —" },
                ...reviewers.map((r) => ({ value: r.id, label: r.email })),
              ]}
              onChange={setReviewerId}
            />
          </div>
          <Button type="submit" disabled={!reviewerId}>
            {submission.reviewerEmail ? "Reassign" : "Assign"}
          </Button>
        </form>
      </Card>

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

      {submission.review ? (
        <Card density="compact">
          <h2 className="font-heading text-base font-semibold text-neutral-900">Review</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip tone={REVIEW_STATUS_TONE[submission.review.status] ?? "neutral"}>
              {statusLabel(submission.review.status)}
            </Chip>
            {submission.review.decision ? (
              <Chip tone={DECISION_TONE[submission.review.decision] ?? "neutral"}>
                {statusLabel(submission.review.decision)}
              </Chip>
            ) : null}
            {submission.review.obtainedMarks !== null ? (
              <span className="text-sm text-neutral-500">
                {submission.review.obtainedMarks} marks
              </span>
            ) : null}
          </div>
          {submission.review.overallComment ? (
            <p className="mt-2 text-sm text-neutral-700">{submission.review.overallComment}</p>
          ) : null}
          {submission.review.scores.length > 0 ? (
            <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
              {submission.review.scores.map((s) => (
                <li key={s.criterionId} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-700">{s.criterionTitle}</span>
                    <span className="text-neutral-500">
                      {s.marksAwarded} / {s.maxMarks}
                    </span>
                  </div>
                  {s.comment ? <p className="mt-1 text-neutral-500">{s.comment}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

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
        open={confirmAssign}
        title={submission.reviewerEmail ? "Reassign reviewer?" : "Assign reviewer?"}
        message={
          <>
            Assign{" "}
            <span className="font-medium text-neutral-800">
              {chosenReviewerEmail ?? "the selected reviewer"}
            </span>{" "}
            to review this submission?
          </>
        }
        confirmLabel={submission.reviewerEmail ? "Reassign" : "Assign"}
        submitting={assigning}
        error={error}
        onConfirm={() => void confirmReviewerAssign()}
        onCancel={() => setConfirmAssign(false)}
      />
    </main>
  );
}

export default function AdminSubmissionDetailPage() {
  return (
    <RequirePermission permission="assignment:manage">
      <AdminSubmissionDetailContent />
    </RequirePermission>
  );
}
