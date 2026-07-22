import type { FileScanStatus } from "./assignment";

// ---------------------------------------------------------------------------
// Enums (mirrored from Prisma as const arrays, per the PERMISSION_CODES /
// MENTOR_TASK_STATUSES convention elsewhere in this package)
// ---------------------------------------------------------------------------

/** ADR-0017: a QUESTION-type Thread is a Doubt Resolution question; its Replies are answers. */
export const THREAD_TYPES = ["DISCUSSION", "QUESTION"] as const;
export type ThreadType = (typeof THREAD_TYPES)[number];

/** The linear open/closed dimension only — isPinned/isLocked/isHidden are independent booleans (ADR-0017). */
export const THREAD_STATUSES = ["OPEN", "CLOSED"] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];

export const COMMUNITY_TARGET_TYPES = ["THREAD", "REPLY"] as const;
export type CommunityTargetType = (typeof COMMUNITY_TARGET_TYPES)[number];

export const COMMUNITY_REPORT_STATUSES = ["PENDING", "REVIEWED", "DISMISSED"] as const;
export type CommunityReportStatus = (typeof COMMUNITY_REPORT_STATUSES)[number];

// ---------------------------------------------------------------------------
// Forums (admin-managed)
// ---------------------------------------------------------------------------

export interface ForumCategory {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  position: number;
  isActive: boolean;
  boardCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ForumBoard {
  id: string;
  categoryId: string;
  categoryTitle: string;
  title: string;
  slug: string;
  description: string | null;
  position: number;
  isActive: boolean;
  threadCount: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Related learning content — four nullable direct links, not a discriminated
// union (ADR-0017: a question links to at most one piece of content).
// ---------------------------------------------------------------------------

export interface RelatedContentRef {
  courseId: string | null;
  lessonId: string | null;
  quizId: string | null;
  assignmentId: string | null;
}

// ---------------------------------------------------------------------------
// Threads & Replies
// ---------------------------------------------------------------------------

export interface CommunityAuthorSummary {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface ThreadSummary {
  id: string;
  boardId: string;
  boardTitle: string;
  type: ThreadType;
  title: string;
  status: ThreadStatus;
  isPinned: boolean;
  isLocked: boolean;
  isHidden: boolean;
  isSolved: boolean;
  viewCount: number;
  replyCount: number;
  likeCount: number;
  author: CommunityAuthorSummary;
  createdAt: string;
  updatedAt: string;
}

/** Full thread view, including body and viewer-scoped reaction state. */
export interface ThreadDetail extends ThreadSummary {
  body: string;
  hiddenReason: string | null;
  relatedContent: RelatedContentRef;
  isBookmarkedByViewer: boolean;
  isFollowedByViewer: boolean;
  isLikedByViewer: boolean;
}

/** A reply, or a Doubt Resolution answer when isAcceptedAnswer is set (ADR-0017). */
export interface Reply {
  id: string;
  threadId: string;
  parentReplyId: string | null;
  body: string;
  isAcceptedAnswer: boolean;
  isHidden: boolean;
  hiddenReason: string | null;
  likeCount: number;
  isLikedByViewer: boolean;
  author: CommunityAuthorSummary;
  children: Reply[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

export interface LikeToggleResult {
  liked: boolean;
  likeCount: number;
}

export interface BookmarkToggleResult {
  bookmarked: boolean;
}

export interface FollowToggleResult {
  following: boolean;
}

// ---------------------------------------------------------------------------
// Reputation (foundation only — no levels/badges/decay this sprint, ADR-0017)
// ---------------------------------------------------------------------------

export interface CommunityProfileSummary {
  userId: string;
  reputationPoints: number;
}

export interface ReputationEventItem {
  id: string;
  points: number;
  reason: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Community Activity Timeline — read-only aggregator, mirrors Student 360's
// ActivityTimelineItem shape (D-50/ADR-0016 precedent, applied per ADR-0017).
// ---------------------------------------------------------------------------

export const COMMUNITY_ACTIVITY_EVENT_TYPES = [
  "THREAD_CREATED",
  "REPLY_POSTED",
  "LIKE_GIVEN",
  "REPUTATION_EVENT",
] as const;
export type CommunityActivityEventType = (typeof COMMUNITY_ACTIVITY_EVENT_TYPES)[number];

export interface CommunityActivityItem {
  type: CommunityActivityEventType;
  occurredAt: string;
  title: string;
  description: string | null;
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export interface CommunityReport {
  id: string;
  reporterId: string;
  reporterEmail: string;
  targetType: CommunityTargetType;
  targetId: string;
  reason: string;
  status: CommunityReportStatus;
  reviewedById: string | null;
  reviewedByEmail: string | null;
  reviewedAt: string | null;
  createdAt: string;
  /** Denormalized preview of the reported thread/reply body, resolved at read time. */
  targetPreview: string | null;
}

// ---------------------------------------------------------------------------
// Attachments — reuses FileScanStatus from the Creative Assignment Engine
// (Sprint 5) rather than redeclaring it (ADR-0017).
// ---------------------------------------------------------------------------

export interface CommunityAttachment {
  id: string;
  threadId: string | null;
  replyId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: FileScanStatus;
  uploadedAt: string;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface CommunitySearchFilters {
  boardId?: string;
  type?: ThreadType;
  status?: ThreadStatus;
  solved?: boolean;
}
