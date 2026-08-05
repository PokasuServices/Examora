"use client";

import * as React from "react";
import type { CommunityAttachment, CommunityTargetType } from "@examora/types";
import { useCommunityApi } from "@/lib/community-api";
import type { UploadItem } from "./types";

/**
 * Owns the attachment list plus the upload queue for one thread/reply target.
 * Same presign → PUT → confirm sequence as the Assignment Workspace's
 * useSubmissionWorkspace, generalized to CommunityTargetType/targetId.
 * The backend only allows attaching files to a target the actor already
 * owns (CommunityAttachmentsService.assertOwnsTarget), so this is only ever
 * mounted once the thread/reply exists — never during compose-before-publish.
 */
export function useAttachments(targetType: CommunityTargetType, targetId: string | null) {
  const api = useCommunityApi();
  const [attachments, setAttachments] = React.useState<CommunityAttachment[]>([]);
  const [uploads, setUploads] = React.useState<UploadItem[]>([]);

  const load = React.useCallback(() => {
    if (!targetId) return;
    api
      .listAttachments(targetType, targetId)
      .then(setAttachments)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Poll while any attachment is still being scanned.
  React.useEffect(() => {
    if (!attachments.some((a) => a.scanStatus === "PENDING")) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [attachments, load]);

  async function uploadFile(file: File): Promise<void> {
    if (!targetId) return;
    const localId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setUploads((prev) => [
      ...prev,
      { localId, fileName: file.name, progress: 0, status: "uploading" },
    ]);

    function updateItem(patch: Partial<UploadItem>) {
      setUploads((prev) => prev.map((u) => (u.localId === localId ? { ...u, ...patch } : u)));
    }

    try {
      const presigned = await api.presignAttachment({
        targetType,
        targetId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      await api.uploadToPresignedUrlWithProgress(presigned.url, file, (percent) =>
        updateItem({ progress: percent }),
      );
      updateItem({ status: "confirming", progress: 100 });
      await api.confirmAttachment({
        targetType,
        targetId,
        storageKey: presigned.key,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      updateItem({ status: "done" });
      load();
    } catch (err) {
      updateItem({ status: "error", error: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setTimeout(() => setUploads((prev) => prev.filter((u) => u.localId !== localId)), 4000);
    }
  }

  function uploadFiles(files: File[]): void {
    for (const file of files) void uploadFile(file);
  }

  async function removeAttachment(attachmentId: string): Promise<void> {
    await api.deleteAttachment(attachmentId);
    load();
  }

  async function downloadAttachment(attachmentId: string): Promise<void> {
    const { url } = await api.getAttachmentDownloadUrl(attachmentId);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return { attachments, uploads, uploadFiles, removeAttachment, downloadAttachment };
}
