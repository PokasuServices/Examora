"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AssignmentComment,
  AssignmentDetail,
  AssignmentSummary,
  PaginatedData,
  PresignedUpload,
  SubmissionDetail,
  SubmissionFile,
  SubmissionHistoryItem,
} from "@examora/types";

/** Typed wrappers over the student-facing assignment catalog + submission endpoints. */
export function useAssignmentApi() {
  const { request } = useAuth();

  return {
    listAssignments: () =>
      request<PaginatedData<AssignmentSummary>>("/assignment-catalog/assignments?pageSize=100", {
        method: "GET",
      }),
    getAssignment: (id: string) =>
      request<AssignmentDetail>(`/assignment-catalog/assignments/${id}`, { method: "GET" }),

    startSubmission: (assignmentId: string) =>
      request<SubmissionDetail>("/assignment-submissions", {
        method: "POST",
        body: { assignmentId },
      }),
    getSubmission: (id: string) =>
      request<SubmissionDetail>(`/assignment-submissions/${id}`, { method: "GET" }),
    updateNotes: (id: string, notes: string) =>
      request<SubmissionDetail>(`/assignment-submissions/${id}`, {
        method: "PATCH",
        body: { notes },
      }),
    listHistory: (assignmentId?: string) =>
      request<PaginatedData<SubmissionHistoryItem>>(
        `/assignment-submissions${assignmentId ? `?assignmentId=${assignmentId}` : ""}`,
        { method: "GET" },
      ),

    presignFile: (
      submissionId: string,
      file: { fileName: string; mimeType: string; sizeBytes: number },
    ) =>
      request<PresignedUpload>(`/assignment-submissions/${submissionId}/files/presign`, {
        method: "POST",
        body: file,
      }),
    /** Uploads directly to storage via the presigned URL — bypasses our API entirely. */
    uploadToPresignedUrl: async (url: string, file: File): Promise<void> => {
      const res = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) {
        throw new Error(`Upload failed (${res.status})`);
      }
    },
    /**
     * Same direct-to-storage PUT, via XMLHttpRequest instead of fetch —
     * fetch has no upload-progress event, XHR does (`upload.onprogress`).
     * Real byte-level progress from the browser, not a simulated bar.
     */
    uploadToPresignedUrlWithProgress: (
      url: string,
      file: File,
      onProgress: (percent: number) => void,
    ): Promise<void> =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      }),
    confirmFile: (
      submissionId: string,
      body: { key: string; fileName: string; mimeType: string; sizeBytes: number },
    ) =>
      request<SubmissionFile>(`/assignment-submissions/${submissionId}/files/confirm`, {
        method: "POST",
        body,
      }),
    removeFile: (submissionId: string, fileId: string) =>
      request<void>(`/assignment-submissions/${submissionId}/files/${fileId}`, {
        method: "DELETE",
      }),
    getDownloadUrl: (submissionId: string, fileId: string) =>
      request<{ url: string }>(
        `/assignment-submissions/${submissionId}/files/${fileId}/download-url`,
        {
          method: "GET",
        },
      ),

    submitFinal: (submissionId: string) =>
      request<SubmissionDetail>(`/assignment-submissions/${submissionId}/submit`, {
        method: "POST",
      }),

    listComments: (submissionId: string) =>
      request<AssignmentComment[]>(`/assignment-submissions/${submissionId}/comments`, {
        method: "GET",
      }),
    addComment: (submissionId: string, body: string) =>
      request<AssignmentComment>(`/assignment-submissions/${submissionId}/comments`, {
        method: "POST",
        body: { body },
      }),
  };
}
