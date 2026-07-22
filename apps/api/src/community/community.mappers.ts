import type {
  CommunityAttachment,
  CommunityAuthorSummary,
  CommunityReport,
  ForumBoard,
  ForumCategory,
  Reply,
  ReputationEventItem,
  ThreadDetail,
  ThreadSummary,
} from "@examora/types";

type ForumCategoryRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  position: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { boards: number };
};

export function toForumCategory(row: ForumCategoryRow): ForumCategory {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    position: row.position,
    isActive: row.isActive,
    boardCount: row._count.boards,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type ForumBoardRow = {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  description: string | null;
  position: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: { title: string };
  _count: { threads: number };
};

export function toForumBoard(row: ForumBoardRow): ForumBoard {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryTitle: row.category.title,
    title: row.title,
    slug: row.slug,
    description: row.description,
    position: row.position,
    isActive: row.isActive,
    threadCount: row._count.threads,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type CommunityAuthorRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

function toCommunityAuthor(row: CommunityAuthorRow): CommunityAuthorSummary {
  return { id: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName };
}

type ThreadSummaryRow = {
  id: string;
  boardId: string;
  type: string;
  title: string;
  status: string;
  isPinned: boolean;
  isLocked: boolean;
  isHidden: boolean;
  isSolved: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  board: { title: string };
  author: CommunityAuthorRow;
  _count: { replies: number };
  likeCount: number;
};

export function toThreadSummary(row: ThreadSummaryRow): ThreadSummary {
  return {
    id: row.id,
    boardId: row.boardId,
    boardTitle: row.board.title,
    type: row.type as ThreadSummary["type"],
    title: row.title,
    status: row.status as ThreadSummary["status"],
    isPinned: row.isPinned,
    isLocked: row.isLocked,
    isHidden: row.isHidden,
    isSolved: row.isSolved,
    viewCount: row.viewCount,
    replyCount: row._count.replies,
    likeCount: row.likeCount,
    author: toCommunityAuthor(row.author),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type ThreadDetailRow = ThreadSummaryRow & {
  body: string;
  hiddenReason: string | null;
  relatedCourseId: string | null;
  relatedLessonId: string | null;
  relatedQuizId: string | null;
  relatedAssignmentId: string | null;
  isBookmarkedByViewer: boolean;
  isFollowedByViewer: boolean;
  isLikedByViewer: boolean;
};

export function toThreadDetail(row: ThreadDetailRow): ThreadDetail {
  return {
    ...toThreadSummary(row),
    body: row.body,
    hiddenReason: row.hiddenReason,
    relatedContent: {
      courseId: row.relatedCourseId,
      lessonId: row.relatedLessonId,
      quizId: row.relatedQuizId,
      assignmentId: row.relatedAssignmentId,
    },
    isBookmarkedByViewer: row.isBookmarkedByViewer,
    isFollowedByViewer: row.isFollowedByViewer,
    isLikedByViewer: row.isLikedByViewer,
  };
}

type ReplyRow = {
  id: string;
  threadId: string;
  parentReplyId: string | null;
  body: string;
  isAcceptedAnswer: boolean;
  isHidden: boolean;
  hiddenReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: CommunityAuthorRow;
  likeCount: number;
  isLikedByViewer: boolean;
  // Optional: a freshly created/updated/moderated single reply has no
  // children yet, so callers need not fabricate an empty array.
  children?: ReplyRow[];
};

type CommunityReportRow = {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  reporter: { email: string };
  reviewedBy: { email: string } | null;
  targetPreview: string | null;
};

export function toCommunityReport(row: CommunityReportRow): CommunityReport {
  return {
    id: row.id,
    reporterId: row.reporterId,
    reporterEmail: row.reporter.email,
    targetType: row.targetType as CommunityReport["targetType"],
    targetId: row.targetId,
    reason: row.reason,
    status: row.status as CommunityReport["status"],
    reviewedById: row.reviewedById,
    reviewedByEmail: row.reviewedBy?.email ?? null,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    targetPreview: row.targetPreview,
  };
}

type CommunityAttachmentRow = {
  id: string;
  threadId: string | null;
  replyId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: string;
  uploadedAt: Date;
};

type ReputationEventRow = {
  id: string;
  points: number;
  reason: string;
  createdAt: Date;
};

export function toReputationEventItem(row: ReputationEventRow): ReputationEventItem {
  return {
    id: row.id,
    points: row.points,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCommunityAttachment(row: CommunityAttachmentRow): CommunityAttachment {
  return {
    id: row.id,
    threadId: row.threadId,
    replyId: row.replyId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    scanStatus: row.scanStatus as CommunityAttachment["scanStatus"],
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

export function toReply(row: ReplyRow): Reply {
  return {
    id: row.id,
    threadId: row.threadId,
    parentReplyId: row.parentReplyId,
    body: row.body,
    isAcceptedAnswer: row.isAcceptedAnswer,
    isHidden: row.isHidden,
    hiddenReason: row.hiddenReason,
    likeCount: row.likeCount,
    isLikedByViewer: row.isLikedByViewer,
    author: toCommunityAuthor(row.author),
    children: (row.children ?? []).map(toReply),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
