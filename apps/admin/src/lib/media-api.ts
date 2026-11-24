"use client";

import { useAuth } from "@examora/auth-client";
import { resolveMediaUrl, type PresignedUpload, type StudyMediaAsset } from "@examora/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "http://localhost:3001/api/v1";

/** Stored image/video reference ("media:<id>" or an https URL) → loadable URL, or null. */
export function adminMediaUrl(ref: string | null | undefined): string | null {
  return resolveMediaUrl(ref, API_BASE_URL);
}

/** Uploads for question/lesson images and videos (study media). */
export function useMediaApi() {
  const { request } = useAuth();

  /** Presign → PUT straight to storage → confirm. Images are then virus-scanned (status PENDING). */
  async function upload(file: File): Promise<StudyMediaAsset> {
    const body = { fileName: file.name, mimeType: file.type, sizeBytes: file.size };
    const presign = await request<PresignedUpload>("/admin/content/media/presign", {
      method: "POST",
      body,
    });
    const put = await fetch(presign.url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!put.ok) {
      throw new Error(`Upload to storage failed (${put.status})`);
    }
    return request<StudyMediaAsset>("/admin/content/media/confirm", {
      method: "POST",
      body: { ...body, storageKey: presign.key },
    });
  }

  return {
    upload,
    get: (id: string) => request<StudyMediaAsset>(`/admin/content/media/${id}`, { method: "GET" }),
  };
}
