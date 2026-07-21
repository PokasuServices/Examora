import type {
  AdminSubmissionDetail,
  Assignment as AssignmentDto,
  AssignmentComment as AssignmentCommentDto,
  AssignmentDetail as AssignmentDetailDto,
  AssignmentReview as AssignmentReviewDto,
  AssignmentSummary,
  AssignmentTemplate as AssignmentTemplateDto,
  FileRules,
  RubricCriterion as RubricCriterionDto,
  RubricScoreEntry,
  RubricSkeletonItem,
  SubmissionDetail,
  SubmissionFile as SubmissionFileDto,
  SubmissionHistoryItem,
} from "@examora/types";
import type {
  Assignment,
  AssignmentComment,
  AssignmentReview,
  AssignmentSubmission,
  AssignmentTemplate,
  Prisma,
  RubricCriterion,
  RubricScore,
  SubmissionFile,
} from "@examora/database";

/** Prisma returns Decimal-typed columns as decimal.js instances, not plain numbers. */
export function decToNum(value: Prisma.Decimal | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

export function toAssignmentTemplate(row: AssignmentTemplate): AssignmentTemplateDto {
  return {
    id: row.id,
    title: row.title,
    brief: row.brief,
    fileRules: row.fileRules as unknown as FileRules,
    marksTotal: decToNum(row.marksTotal),
    rubric: row.rubric as unknown as RubricSkeletonItem[],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toRubricCriterion(row: RubricCriterion): RubricCriterionDto {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    title: row.title,
    description: row.description,
    maxMarks: decToNum(row.maxMarks),
    position: row.position,
  };
}

export function toAssignment(row: Assignment): AssignmentDto {
  return {
    id: row.id,
    subjectId: row.subjectId,
    title: row.title,
    slug: row.slug,
    brief: row.brief,
    fileRules: row.fileRules as unknown as FileRules,
    marksTotal: decToNum(row.marksTotal),
    deadline: row.deadline ? row.deadline.toISOString() : null,
    status: row.status,
    position: row.position,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAssignmentDetail(
  row: Assignment & { criteria: RubricCriterion[] },
): AssignmentDetailDto {
  return { ...toAssignment(row), criteria: row.criteria.map(toRubricCriterion) };
}

export function toAssignmentSummary(
  row: Assignment & { criteria: { id: string }[] },
): AssignmentSummary {
  return {
    id: row.id,
    subjectId: row.subjectId,
    title: row.title,
    slug: row.slug,
    brief: row.brief,
    marksTotal: decToNum(row.marksTotal),
    deadline: row.deadline ? row.deadline.toISOString() : null,
    criteriaCount: row.criteria.length,
  };
}

export function toSubmissionFile(row: SubmissionFile): SubmissionFileDto {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    scanStatus: row.scanStatus,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

export function toAssignmentComment(
  row: AssignmentComment & { author: { email: string } },
): AssignmentCommentDto {
  return {
    id: row.id,
    submissionId: row.submissionId,
    authorId: row.authorId,
    authorEmail: row.author.email,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toRubricScoreEntry(
  row: RubricScore & { criterion: RubricCriterion },
): RubricScoreEntry {
  return {
    criterionId: row.criterionId,
    criterionTitle: row.criterion.title,
    maxMarks: decToNum(row.criterion.maxMarks),
    marksAwarded: decToNum(row.marksAwarded),
    comment: row.comment,
  };
}

export function toAssignmentReview(
  row: AssignmentReview & { scores: (RubricScore & { criterion: RubricCriterion })[] },
): AssignmentReviewDto {
  return {
    id: row.id,
    submissionId: row.submissionId,
    reviewerId: row.reviewerId,
    status: row.status,
    overallComment: row.overallComment,
    decision: row.decision,
    obtainedMarks: row.obtainedMarks !== null ? decToNum(row.obtainedMarks) : null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    scores: row.scores.map(toRubricScoreEntry),
  };
}

type SubmissionDetailRow = AssignmentSubmission & {
  assignment: { title: string };
  files: SubmissionFile[];
  comments: (AssignmentComment & { author: { email: string } })[];
  review: (AssignmentReview & { scores: (RubricScore & { criterion: RubricCriterion })[] }) | null;
};

export function toSubmissionDetail(row: SubmissionDetailRow): SubmissionDetail {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    assignmentTitle: row.assignment.title,
    studentId: row.studentId,
    version: row.version,
    status: row.status,
    notes: row.notes,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    files: row.files.map(toSubmissionFile),
    comments: row.comments.map(toAssignmentComment),
    // Only ever expose a PUBLISHED review to a student/reviewer via this shared
    // detail endpoint — a DRAFT (unpublished) review stays reviewer-only.
    review: row.review && row.review.status === "PUBLISHED" ? toAssignmentReview(row.review) : null,
  };
}

export function toSubmissionHistoryItem(
  row: AssignmentSubmission & {
    assignment: { title: string };
    review: { obtainedMarks: Prisma.Decimal | null; decision: string | null } | null;
  },
): SubmissionHistoryItem {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    assignmentTitle: row.assignment.title,
    version: row.version,
    status: row.status,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    obtainedMarks:
      row.review?.obtainedMarks !== null && row.review?.obtainedMarks !== undefined
        ? decToNum(row.review.obtainedMarks)
        : null,
    decision: (row.review?.decision as SubmissionHistoryItem["decision"]) ?? null,
  };
}

type ReviewerSubmissionRow = AssignmentSubmission & {
  assignment: { title: string; criteria: RubricCriterion[] };
  files: SubmissionFile[];
  comments: (AssignmentComment & { author: { email: string } })[];
  review: (AssignmentReview & { scores: (RubricScore & { criterion: RubricCriterion })[] }) | null;
};

export function toReviewerSubmissionView(row: ReviewerSubmissionRow) {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    assignmentTitle: row.assignment.title,
    studentId: row.studentId,
    version: row.version,
    status: row.status,
    notes: row.notes,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    files: row.files.map(toSubmissionFile),
    comments: row.comments.map(toAssignmentComment),
    criteria: row.assignment.criteria.map(toRubricCriterion),
    review: row.review ? toAssignmentReview(row.review) : null,
  };
}

export function toReviewerQueueItem(
  row: AssignmentSubmission & { assignment: { title: string }; student: { email: string } },
) {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    assignmentTitle: row.assignment.title,
    studentId: row.studentId,
    studentEmail: row.student.email,
    version: row.version,
    status: row.status,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
  };
}

type AdminSubmissionRow = AssignmentSubmission & {
  assignment: { title: string };
  student: { email: string };
  reviewer: { email: string } | null;
};

export function toAdminSubmissionSummary(row: AdminSubmissionRow) {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    assignmentTitle: row.assignment.title,
    studentId: row.studentId,
    studentEmail: row.student.email,
    reviewerId: row.reviewerId,
    reviewerEmail: row.reviewer?.email ?? null,
    version: row.version,
    status: row.status,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
  };
}

export function toAdminSubmissionDetail(
  row: AdminSubmissionRow & {
    files: SubmissionFile[];
    comments: (AssignmentComment & { author: { email: string } })[];
    review:
      (AssignmentReview & { scores: (RubricScore & { criterion: RubricCriterion })[] }) | null;
  },
): AdminSubmissionDetail {
  return {
    ...toAdminSubmissionSummary(row),
    files: row.files.map(toSubmissionFile),
    comments: row.comments.map(toAssignmentComment),
    review: row.review ? toAssignmentReview(row.review) : null,
  };
}
