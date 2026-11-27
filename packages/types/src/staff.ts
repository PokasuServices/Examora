/** Staff workflows shared by administrators and mentors (mentor module, MF0). */

/** Records a mentor can ask an administrator to delete. */
export const DELETION_TARGET_TYPES = [
  "category",
  "course",
  "subject",
  "topic",
  "module",
  "lesson",
  "question",
  "quiz",
  "assignment",
  "assignment-template",
  "practice-category",
  "rubric",
  "checkpoint",
  "college",
  "webinar",
  "batch",
] as const;
export type DeletionTargetType = (typeof DELETION_TARGET_TYPES)[number];

export const DELETION_TARGET_LABEL: Record<DeletionTargetType, string> = {
  category: "Category",
  course: "Course",
  subject: "Subject",
  topic: "Topic",
  module: "Module",
  lesson: "Lesson",
  question: "Question",
  quiz: "Quiz / test",
  assignment: "Assignment",
  "assignment-template": "Assignment template",
  "practice-category": "Practice tab",
  rubric: "Rating set",
  checkpoint: "Checkpoint",
  college: "College",
  webinar: "Webinar",
  batch: "Batch",
};

/** Error code the API returns when a protected delete needs an admin's approval. */
export const DELETION_NEEDS_APPROVAL = "DELETION_NEEDS_APPROVAL";

export type DeletionRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

/** What deleting a record would affect, shown before asking and to the reviewer. */
export interface DeletionPreview {
  targetType: DeletionTargetType;
  targetId: string;
  label: string;
  /** e.g. [{ label: "Attempts", count: 120 }] */
  impact: { label: string; count: number }[];
  /** An open request for this record, if any. */
  pendingRequestId: string | null;
}

export interface DeletionRequestView {
  id: string;
  targetType: DeletionTargetType;
  targetId: string;
  targetLabel: string;
  reason: string;
  impact: { label: string; count: number }[];
  status: DeletionRequestStatus;
  requestedBy: { id: string; name: string; email: string };
  decidedBy: { id: string; name: string } | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}
