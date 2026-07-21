"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError, useAuth } from "@examora/auth-client";
import type { AdminSubmissionDetail, PaginatedData, UserProfile } from "@examora/types";
import { Button, FieldError, Input } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { useAssignmentAdminApi } from "@/lib/assignment-api";

function AdminSubmissionDetailContent() {
  const { id } = useParams<{ id: string }>();
  const api = useAssignmentAdminApi();
  const { request } = useAuth();
  const [submission, setSubmission] = React.useState<AdminSubmissionDetail | null>(null);
  const [reviewers, setReviewers] = React.useState<UserProfile[]>([]);
  const [reviewerId, setReviewerId] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .getSubmissionDetail(id)
      .then(setSubmission)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load"));
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

  async function assignReviewer(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!reviewerId) return;
    setError(null);
    try {
      await api.assignReviewer(id, reviewerId);
      setReviewerId("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign reviewer");
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

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/assignments/submissions" className="hover:underline">
          Submissions
        </Link>{" "}
        · <span className="text-neutral-800">{submission.assignmentTitle}</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-heading">{submission.assignmentTitle}</h1>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm">{submission.status}</span>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        Student: {submission.studentEmail} · Version {submission.version}
      </p>
      <FieldError>{error}</FieldError>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Reviewer</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Currently: {submission.reviewerEmail ?? "Unassigned"}
        </p>
        <form onSubmit={assignReviewer} className="mt-3 flex items-end gap-3">
          <select
            className="h-10 w-64 rounded-md border border-neutral-300 px-3 text-sm"
            value={reviewerId}
            onChange={(e) => setReviewerId(e.target.value)}
          >
            <option value="">— choose reviewer —</option>
            {reviewers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.email}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={!reviewerId}>
            {submission.reviewerEmail ? "Reassign" : "Assign"}
          </Button>
        </form>
      </section>

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

      {submission.review ? (
        <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Review</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Status: {submission.review.status}
            {submission.review.decision ? ` · Decision: ${submission.review.decision}` : ""}
            {submission.review.obtainedMarks !== null
              ? ` · ${submission.review.obtainedMarks} marks`
              : ""}
          </p>
          {submission.review.overallComment ? (
            <p className="mt-2 text-sm text-neutral-700">{submission.review.overallComment}</p>
          ) : null}
          {submission.review.scores.length > 0 ? (
            <ul className="mt-3 divide-y divide-neutral-100">
              {submission.review.scores.map((s) => (
                <li key={s.criterionId} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{s.criterionTitle}</span>
                    <span className="text-neutral-500">
                      {s.marksAwarded} / {s.maxMarks}
                    </span>
                  </div>
                  {s.comment ? <p className="mt-1 text-neutral-500">{s.comment}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

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

export default function AdminSubmissionDetailPage() {
  return (
    <RequirePermission permission="assignment:manage">
      <AdminSubmissionDetailContent />
    </RequirePermission>
  );
}
