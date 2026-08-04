"use client";

import * as React from "react";
import type { AssignmentComment, AssignmentDetail, SubmissionDetail } from "@examora/types";
import { useAssignmentApi } from "@/lib/assignment-api";
import type { AutosaveStatus } from "@/components/ui/autosave-indicator";
import type { UploadItem } from "./types";

type LoadState = "loading" | "ready" | "not-found";

/**
 * Fetches the submission, then (once we know assignmentId) the parent
 * assignment for the persistent brief/rubric reference panel, plus the
 * comment thread. Polls while any file is still being malware-scanned —
 * same interval the previous page used. File uploads are queued locally so
 * multiple files can be dropped at once, even though each still goes
 * through the same one-file-at-a-time presign/PUT/confirm sequence
 * server-side (no batch-upload endpoint exists).
 */
export function useSubmissionWorkspace(submissionId: string) {
  const api = useAssignmentApi();

  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [submission, setSubmission] = React.useState<SubmissionDetail | null>(null);
  const [assignment, setAssignment] = React.useState<AssignmentDetail | null>(null);
  const [comments, setComments] = React.useState<AssignmentComment[]>([]);
  const [notes, setNotes] = React.useState("");
  const [notesStatus, setNotesStatus] = React.useState<AutosaveStatus>("idle");
  const [uploads, setUploads] = React.useState<UploadItem[]>([]);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [postingComment, setPostingComment] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const s = await api.getSubmission(submissionId);
      setSubmission(s);
      setNotes(s.notes ?? "");
      setLoadState("ready");
      const [a, c] = await Promise.all([
        api.getAssignment(s.assignmentId).catch(() => null),
        api.listComments(submissionId).catch(() => []),
      ]);
      if (a) setAssignment(a);
      setComments(c);
    } catch {
      setLoadState("not-found");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Poll while any file is still being scanned.
  React.useEffect(() => {
    if (!submission?.files.some((f) => f.scanStatus === "PENDING")) return;
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [submission, load]);

  async function saveNotes(value: string): Promise<void> {
    setNotesStatus("saving");
    try {
      await api.updateNotes(submissionId, value);
      setNotesStatus("saved");
    } catch {
      setNotesStatus("error");
    }
  }

  async function uploadFile(file: File): Promise<void> {
    const localId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setUploads((prev) => [
      ...prev,
      { localId, fileName: file.name, progress: 0, status: "uploading" },
    ]);

    function updateItem(patch: Partial<UploadItem>) {
      setUploads((prev) => prev.map((u) => (u.localId === localId ? { ...u, ...patch } : u)));
    }

    try {
      const presigned = await api.presignFile(submissionId, {
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      await api.uploadToPresignedUrlWithProgress(presigned.url, file, (percent) =>
        updateItem({ progress: percent }),
      );
      updateItem({ status: "confirming", progress: 100 });
      await api.confirmFile(submissionId, {
        key: presigned.key,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      updateItem({ status: "done" });
      await load();
    } catch (err) {
      updateItem({ status: "error", error: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      // Clear finished/errored entries after a moment so the queue doesn't grow forever.
      setTimeout(() => setUploads((prev) => prev.filter((u) => u.localId !== localId)), 4000);
    }
  }

  function uploadFiles(files: FileList | File[]): void {
    for (const file of Array.from(files)) void uploadFile(file);
  }

  async function removeFile(fileId: string): Promise<void> {
    await api.removeFile(submissionId, fileId);
    await load();
  }

  async function downloadFile(fileId: string): Promise<void> {
    const { url } = await api.getDownloadUrl(submissionId, fileId);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function submit(): Promise<void> {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await api.submitFinal(submissionId);
      await load();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }

  async function postComment(body: string): Promise<void> {
    setPostingComment(true);
    try {
      await api.addComment(submissionId, body);
      setComments(await api.listComments(submissionId));
    } finally {
      setPostingComment(false);
    }
  }

  async function startResubmission(): Promise<string> {
    if (!submission) throw new Error("Submission not loaded");
    const next = await api.startSubmission(submission.assignmentId);
    return next.id;
  }

  return {
    loadState,
    submission,
    assignment,
    comments,
    notes,
    setNotes,
    notesStatus,
    saveNotes,
    uploads,
    uploadFiles,
    removeFile,
    downloadFile,
    submitError,
    submitting,
    submit,
    postingComment,
    postComment,
    startResubmission,
  };
}
