import type { ContentStatus } from "./content";

export const ASSIGNMENT_SUBMISSION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
] as const;
export type AssignmentSubmissionStatus = (typeof ASSIGNMENT_SUBMISSION_STATUSES)[number];

export const REVIEW_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_DECISIONS = ["APPROVED", "REVISION_REQUESTED"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const FILE_SCAN_STATUSES = ["PENDING", "CLEAN", "INFECTED", "FAILED"] as const;
export type FileScanStatus = (typeof FILE_SCAN_STATUSES)[number];

export interface PresignedUpload {
  url: string;
  key: string;
}

export interface FileRules {
  allowedMimeTypes: string[];
  maxFileSizeMb: number;
  maxFiles: number;
}

export interface RubricSkeletonItem {
  title: string;
  description?: string;
  maxMarks: number;
}

// ---------------------------------------------------------------------------
// Templates & authoring (admin)
// ---------------------------------------------------------------------------

export interface AssignmentTemplate {
  id: string;
  title: string;
  brief: string;
  fileRules: FileRules;
  marksTotal: number;
  rubric: RubricSkeletonItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RubricCriterion {
  id: string;
  assignmentId: string;
  title: string;
  description: string | null;
  maxMarks: number;
  position: number;
}

export interface Assignment {
  id: string;
  subjectId: string | null;
  title: string;
  slug: string;
  brief: string;
  fileRules: FileRules;
  marksTotal: number;
  deadline: string | null;
  status: ContentStatus;
  position: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentDetail extends Assignment {
  criteria: RubricCriterion[];
}

// ---------------------------------------------------------------------------
// Student catalog (published only)
// ---------------------------------------------------------------------------

export interface AssignmentSummary {
  id: string;
  subjectId: string | null;
  title: string;
  slug: string;
  brief: string;
  marksTotal: number;
  deadline: string | null;
  criteriaCount: number;
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export interface SubmissionFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: FileScanStatus;
  uploadedAt: string;
}

export interface AssignmentComment {
  id: string;
  submissionId: string;
  authorId: string;
  authorEmail: string;
  body: string;
  createdAt: string;
}

export interface RubricScoreEntry {
  criterionId: string;
  criterionTitle: string;
  maxMarks: number;
  marksAwarded: number;
  comment: string | null;
}

export interface AssignmentReview {
  id: string;
  submissionId: string;
  reviewerId: string;
  status: ReviewStatus;
  overallComment: string | null;
  decision: ReviewDecision | null;
  obtainedMarks: number | null;
  publishedAt: string | null;
  scores: RubricScoreEntry[];
}

/** A student's own submission, with files/comments/the published review if any. */
export interface SubmissionDetail {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentId: string;
  version: number;
  status: AssignmentSubmissionStatus;
  notes: string | null;
  submittedAt: string | null;
  createdAt: string;
  files: SubmissionFile[];
  comments: AssignmentComment[];
  review: AssignmentReview | null;
}

export interface SubmissionHistoryItem {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  version: number;
  status: AssignmentSubmissionStatus;
  submittedAt: string | null;
  obtainedMarks: number | null;
  decision: ReviewDecision | null;
}

// ---------------------------------------------------------------------------
// Reviewer
// ---------------------------------------------------------------------------

/**
 * The reviewer's own view of a submission — unlike SubmissionDetail (shared
 * with the student), this always includes the review regardless of
 * DRAFT/PUBLISHED status (since only the assigned reviewer can fetch it),
 * plus the assignment's full rubric criteria list to score against.
 */
export interface ReviewerSubmissionView extends Omit<SubmissionDetail, "review"> {
  criteria: RubricCriterion[];
  review: AssignmentReview | null;
}

export interface ReviewerQueueItem {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentId: string;
  studentEmail: string;
  version: number;
  status: AssignmentSubmissionStatus;
  submittedAt: string | null;
}

// ---------------------------------------------------------------------------
// Admin monitoring
// ---------------------------------------------------------------------------

export interface AdminSubmissionSummary {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentId: string;
  studentEmail: string;
  reviewerId: string | null;
  reviewerEmail: string | null;
  version: number;
  status: AssignmentSubmissionStatus;
  submittedAt: string | null;
}

/** Admin sees everything on a submission regardless of DRAFT/PUBLISHED review status. */
export interface AdminSubmissionDetail extends AdminSubmissionSummary {
  files: SubmissionFile[];
  comments: AssignmentComment[];
  review: AssignmentReview | null;
}
