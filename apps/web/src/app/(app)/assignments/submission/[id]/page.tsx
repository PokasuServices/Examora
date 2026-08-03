"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { AssignmentComment, SubmissionDetail } from "@examora/types";
import { Button } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { useAssignmentApi } from "@/lib/assignment-api";

const SCAN_LABEL: Record<string, string> = {
  PENDING: "Scanning…",
  CLEAN: "Ready",
  INFECTED: "Blocked (infected)",
  FAILED: "Scan failed",
};

function SubmissionContent() {
  const { id: submissionId } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useAssignmentApi();
  const [submission, setSubmission] = React.useState<SubmissionDetail | null>(null);
  const [comments, setComments] = React.useState<AssignmentComment[]>([]);
  const [notes, setNotes] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [commentBody, setCommentBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(() => {
    api
      .getSubmission(submissionId)
      .then((s) => {
        setSubmission(s);
        setNotes(s.notes ?? "");
      })
      .catch(() => undefined);
    api
      .listComments(submissionId)
      .then(setComments)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Poll while any file is still being scanned.
  React.useEffect(() => {
    if (!submission?.files.some((f) => f.scanStatus === "PENDING")) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [submission, load]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const presigned = await api.presignFile(submissionId, {
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      await api.uploadToPresignedUrl(presigned.url, file);
      await api.confirmFile(submissionId, {
        key: presigned.key,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeFile(fileId: string): Promise<void> {
    await api.removeFile(submissionId, fileId);
    load();
  }

  async function saveNotes(): Promise<void> {
    await api.updateNotes(submissionId, notes);
  }

  async function submitFinal(): Promise<void> {
    setError(null);
    try {
      await api.submitFinal(submissionId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    }
  }

  async function postComment(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!commentBody.trim()) return;
    await api.addComment(submissionId, commentBody);
    setCommentBody("");
    api
      .listComments(submissionId)
      .then(setComments)
      .catch(() => undefined);
  }

  async function startResubmission(): Promise<void> {
    if (!submission) return;
    const next = await api.startSubmission(submission.assignmentId);
    router.push(`/assignments/submission/${next.id}`);
  }

  if (!submission) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  const isDraft = submission.status === "DRAFT";
  const isDecided = submission.status === "APPROVED" || submission.status === "REVISION_REQUESTED";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href={`/assignments/${submission.assignmentId}`} className="hover:underline">
          {submission.assignmentTitle}
        </Link>{" "}
        · <span className="text-neutral-800">Submission v{submission.version}</span>
      </nav>

      <div className="flex items-center gap-3">
        <h1 className="text-heading">{submission.assignmentTitle}</h1>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
          {submission.status}
        </span>
      </div>

      {isDecided && submission.review ? (
        <div
          className={`mt-6 rounded-lg border p-5 ${
            submission.status === "APPROVED"
              ? "border-success-600 bg-success-500/10"
              : "border-warning-500 bg-warning-500/10"
          }`}
        >
          <p className="font-semibold">
            {submission.status === "APPROVED" ? "Approved" : "Revision requested"} —{" "}
            {submission.review.obtainedMarks} marks
          </p>
          {submission.review.overallComment ? (
            <p className="mt-2 text-sm text-neutral-700">{submission.review.overallComment}</p>
          ) : null}
          <ul className="mt-3 space-y-2">
            {submission.review.scores.map((s) => (
              <li key={s.criterionId} className="text-sm">
                <span className="font-medium">{s.criterionTitle}</span>: {s.marksAwarded} /{" "}
                {s.maxMarks}
                {s.comment ? <span className="text-neutral-600"> — {s.comment}</span> : null}
              </li>
            ))}
          </ul>
          {submission.status === "REVISION_REQUESTED" ? (
            <div className="mt-4">
              <Button onClick={() => void startResubmission()}>Start a revised submission</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!isDecided ? (
        <>
          <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Files</h2>
            <ul className="mt-3 space-y-2">
              {submission.files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm"
                >
                  <span>{f.fileName}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={
                        f.scanStatus === "CLEAN"
                          ? "text-success-600"
                          : f.scanStatus === "INFECTED" || f.scanStatus === "FAILED"
                            ? "text-error-600"
                            : "text-neutral-500"
                      }
                    >
                      {SCAN_LABEL[f.scanStatus] ?? f.scanStatus}
                    </span>
                    {isDraft ? (
                      <Button variant="ghost" onClick={() => void removeFile(f.id)}>
                        Remove
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
              {submission.files.length === 0 ? (
                <li className="text-sm text-neutral-500">No files uploaded yet.</li>
              ) : null}
            </ul>
            {isDraft ? (
              <div className="mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => void handleFileChange(e)}
                  disabled={uploading}
                />
                {uploading ? (
                  <span className="ml-2 text-sm text-neutral-500">Uploading…</span>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Notes</h2>
            <textarea
              className="mt-3 min-h-24 w-full rounded-md border border-neutral-300 p-3 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => void saveNotes()}
              disabled={!isDraft}
              placeholder="Notes for your reviewer (optional)"
            />
          </section>

          {error ? <p className="mt-3 text-sm text-error-600">{error}</p> : null}

          {isDraft ? (
            <div className="mt-6">
              <Button onClick={() => void submitFinal()}>Submit</Button>
            </div>
          ) : (
            <p className="mt-6 text-sm text-neutral-500">Awaiting review.</p>
          )}
        </>
      ) : null}

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-neutral-700">Comments</h2>
        <ul className="mt-2 space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-md bg-neutral-50 px-3 py-2 text-sm">
              <span className="font-medium">{c.authorEmail}</span>: {c.body}
            </li>
          ))}
        </ul>
        <form onSubmit={postComment} className="mt-3 flex gap-2">
          <input
            className="h-10 flex-1 rounded-md border border-neutral-300 px-3 text-sm"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add a comment…"
          />
          <Button type="submit">Post</Button>
        </form>
      </section>
    </main>
  );
}

export default function SubmissionPage() {
  return (
    <RequireAuth>
      <SubmissionContent />
    </RequireAuth>
  );
}
