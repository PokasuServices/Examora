import { BadRequestException } from "@nestjs/common";
import type { CmsWorkflowStatus } from "@examora/types";

/**
 * Draft -> Review -> Approval -> Publish -> Archive state machine (Sprint 12,
 * ADR-0022 §1) — shared by every CMS content type. A rejected review sends
 * content back to DRAFT; an approved item can also be sent back to DRAFT
 * (e.g. the publisher spots an issue before publishing); ARCHIVED can be
 * reopened to DRAFT to edit and republish.
 */
const VALID_TRANSITIONS: Record<CmsWorkflowStatus, CmsWorkflowStatus[]> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["PUBLISHED", "DRAFT"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function assertValidCmsTransition(from: CmsWorkflowStatus, to: CmsWorkflowStatus): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new BadRequestException(`Cannot transition CMS content from ${from} to ${to}`);
  }
}
