import type { PresignedUpload } from "@examora/types";

export const STORAGE_PORT = "STORAGE_PORT";

export type { PresignedUpload };

/**
 * Object-storage seam (ADR-0015). Presigned-URL based: the API only ever
 * signs URLs and reads/deletes objects for server-side work (the malware
 * scan job) — it never proxies upload/download bytes itself.
 */
export interface StoragePort {
  /**
   * `contentLength` is signed into the presigned PUT URL (S3 SigV4) so the
   * upload is rejected with a signature mismatch if the actual uploaded
   * bytes don't match the size the caller already validated against the
   * relevant max-size rule — closes the gap where a client could otherwise
   * declare an honest size at presign time and then upload something larger
   * directly to storage.
   */
  createPresignedUploadUrl(params: {
    key: string;
    contentType: string;
    contentLength: number;
  }): Promise<PresignedUpload>;
  createPresignedDownloadUrl(key: string): Promise<string>;
  getObjectBuffer(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
}
