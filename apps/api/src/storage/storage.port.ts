import type { PresignedUpload } from "@examora/types";

export const STORAGE_PORT = "STORAGE_PORT";

export type { PresignedUpload };

/**
 * Object-storage seam (ADR-0015). Presigned-URL based: the API only ever
 * signs URLs and reads/deletes objects for server-side work (the malware
 * scan job) — it never proxies upload/download bytes itself.
 */
export interface StoragePort {
  createPresignedUploadUrl(params: { key: string; contentType: string }): Promise<PresignedUpload>;
  createPresignedDownloadUrl(key: string): Promise<string>;
  getObjectBuffer(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
}
