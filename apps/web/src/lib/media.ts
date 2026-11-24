import { defaultUrlTransform } from "react-markdown";
import { MEDIA_SCHEME, resolveMediaUrl } from "@examora/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

/** Stored image/video reference ("media:<id>" or an http(s) URL) → loadable URL, or null. */
export function mediaUrl(ref: string | null | undefined): string | null {
  return resolveMediaUrl(ref, API_BASE_URL);
}

/**
 * react-markdown strips unknown URL schemes; resolve our "media:" refs first
 * so explanations and lessons can embed uploaded images (![alt](media:<id>)).
 */
export function studyUrlTransform(url: string): string {
  if (url.startsWith(MEDIA_SCHEME)) return mediaUrl(url) ?? "";
  return defaultUrlTransform(url);
}
