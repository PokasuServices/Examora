import type { CmsWorkflowStatus } from "@examora/types";
import type { ChipTone } from "@/components/ui/chip";

const CMS_STATUS_TONE: Record<CmsWorkflowStatus, ChipTone> = {
  DRAFT: "neutral",
  IN_REVIEW: "warning",
  APPROVED: "accent",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
};

export function cmsStatusTone(status: CmsWorkflowStatus): ChipTone {
  return CMS_STATUS_TONE[status];
}

/** Mirrors the server's assertValidCmsTransition exactly (cms-workflow.util.ts) — never offer a transition the backend would reject. */
const VALID_TRANSITIONS: Record<CmsWorkflowStatus, CmsWorkflowStatus[]> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["PUBLISHED", "DRAFT"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function validCmsStatusTransitions(status: CmsWorkflowStatus): CmsWorkflowStatus[] {
  return VALID_TRANSITIONS[status];
}

const TRANSITION_ACTION_LABEL: Record<CmsWorkflowStatus, string> = {
  DRAFT: "Send back to draft",
  IN_REVIEW: "Submit for review",
  APPROVED: "Approve",
  PUBLISHED: "Publish",
  ARCHIVED: "Archive",
};

export function transitionActionLabel(target: CmsWorkflowStatus): string {
  return TRANSITION_ACTION_LABEL[target];
}
