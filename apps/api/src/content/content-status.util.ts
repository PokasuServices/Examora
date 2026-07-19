import { BadRequestException } from "@nestjs/common";
import type { ContentStatus } from "@examora/types";

/**
 * Allowed content-status transitions (ADR-0012). A node can be published or
 * archived from DRAFT, unpublished back to DRAFT, archived from PUBLISHED, and
 * restored (to DRAFT) from ARCHIVED. Any other transition is rejected.
 */
const ALLOWED_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function assertValidStatusTransition(from: ContentStatus, to: ContentStatus): void {
  if (from === to) {
    return;
  }
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new BadRequestException(`Cannot change status from ${from} to ${to}`);
  }
}
