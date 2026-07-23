/** Mirrors the `content_status` enum in database/prisma/schema.prisma (ADR-0012). */
export const CONTENT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Mirrors the `lesson_content_type` enum in database/prisma/schema.prisma. */
export const LESSON_CONTENT_TYPES = ["TEXT", "VIDEO", "PDF", "IMAGE", "ARTICLE"] as const;
export type LessonContentType = (typeof LESSON_CONTENT_TYPES)[number];

interface ContentNodeBase {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** Course/Subject/Topic/Module carry a free-text description; Lesson does not (its body is the content). */
interface DescribedContentNode extends ContentNodeBase {
  description: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Course extends DescribedContentNode {
  categoryId: string | null;
  examType: string | null;
  publishedAt: string | null;
  /** Sprint 8 (ADR-0018): null means the course is free. */
  priceAmount: number | null;
  priceCurrency: string;
}

export interface Subject extends DescribedContentNode {
  courseId: string;
}

export interface Topic extends DescribedContentNode {
  subjectId: string;
}

export interface Module extends DescribedContentNode {
  topicId: string;
  type: string | null;
}

export interface Lesson extends ContentNodeBase {
  moduleId: string;
  contentType: LessonContentType;
  body: string | null;
  contentUrl: string | null;
  durationMinutes: number | null;
}
