export interface UploadItem {
  localId: string;
  fileName: string;
  progress: number;
  status: "uploading" | "confirming" | "done" | "error";
  error?: string;
}

/**
 * Mirrors the API's hardcoded community-attachments allowlist
 * (CommunityAttachmentsService.ALLOWED_MIME_TYPES / MAX_SIZE_BYTES) — no
 * per-board configurable FileRules and no file-count cap exist for Community,
 * unlike Assignment's FileRules (ADR-0017), so there is no maxFiles here.
 */
export const COMMUNITY_ATTACHMENT_RULES: { allowedMimeTypes: string[]; maxFileSizeMb: number } = {
  allowedMimeTypes: [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
  maxFileSizeMb: 10,
};
