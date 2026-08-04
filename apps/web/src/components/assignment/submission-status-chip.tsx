import type { AssignmentSubmissionStatus } from "@examora/types";
import { Chip, type ChipTone } from "@/components/ui/chip";

const STATUS_LABEL: Record<AssignmentSubmissionStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  REVISION_REQUESTED: "Revision requested",
  APPROVED: "Approved",
};

const STATUS_TONE: Record<AssignmentSubmissionStatus, ChipTone> = {
  DRAFT: "neutral",
  SUBMITTED: "primary",
  UNDER_REVIEW: "warning",
  REVISION_REQUESTED: "warning",
  APPROVED: "success",
};

/** The one place submission-status color/label is defined — reused on Landing, the Workspace header, and history lists so they never disagree. */
export function SubmissionStatusChip({ status }: { status: AssignmentSubmissionStatus }) {
  return <Chip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Chip>;
}
