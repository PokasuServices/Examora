import type { ContentStatus } from "@examora/types";
import type { ChipTone } from "@/components/ui/chip";

const CONTENT_STATUS_TONE: Record<ContentStatus, ChipTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

export function contentStatusTone(status: ContentStatus): ChipTone {
  return CONTENT_STATUS_TONE[status];
}

/** Mirrors the server's assertValidStatusTransition exactly (content-status.util.ts) — never offer a transition the backend would reject. */
const VALID_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function validContentStatusTransitions(status: ContentStatus): ContentStatus[] {
  return VALID_TRANSITIONS[status];
}
