/**
 * Uploaded study media (question/option/explanation images, uploaded videos)
 * is stored in content as "media:<assetId>" so links survive moving between
 * environments; the API serves it at `<apiBase>/media/<assetId>`.
 * Plain http(s) URLs are passed through unchanged.
 */
export const MEDIA_SCHEME = "media:";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toMediaRef(assetId: string): string {
  return MEDIA_SCHEME + assetId;
}

/** Turns a stored image/video reference into a URL a browser can load, or null if it isn't one. */
export function resolveMediaUrl(url: string | null | undefined, apiBase: string): string | null {
  if (!url) return null;
  if (url.startsWith(MEDIA_SCHEME)) {
    const id = url.slice(MEDIA_SCHEME.length);
    return UUID.test(id) ? `${apiBase.replace(/\/$/, "")}/media/${id}` : null;
  }
  return /^https?:\/\//i.test(url) ? url : null;
}

/** An uploaded study image/video as the admin editor sees it. */
export interface StudyMediaAsset {
  id: string;
  /** What to store in content: "media:<id>". */
  ref: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Images are served once CLEAN (after the virus scan); videos are CLEAN immediately. */
  scanStatus: "PENDING" | "CLEAN" | "INFECTED" | "FAILED";
}
