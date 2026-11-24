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
  /** Shown on the student Learn page's syllabus heatmap. */
  nextExamDate: string | null;
}

export interface Subject extends DescribedContentNode {
  courseId: string;
  /** "SUBJECT" or "ESSENTIALS": the tag on the student's subject card. */
  kind: "SUBJECT" | "ESSENTIALS";
  /** Icon name for the subject card (see SUBJECT_ICONS); null = default. */
  icon: string | null;
  /** Colour family for the icon badge (see SUBJECT_COLORS); null = primary. */
  color: string | null;
}

/** Icon names the student Learn page can draw on a subject card. */
export const SUBJECT_ICONS = [
  "brain",
  "lightbulb",
  "eye",
  "globe",
  "sigma",
  "languages",
  "pencil",
  "clipboard-list",
  "rocket",
] as const;

/** Colour families for a subject card's icon badge. */
export const SUBJECT_COLORS = [
  "slate",
  "amber",
  "violet",
  "rose",
  "pink",
  "emerald",
  "sky",
  "purple",
  "indigo",
] as const;

/** One cell of a course's syllabus heatmap (questions per subject per past-paper year). */
export interface PastPaperStatRow {
  examLabel: string;
  subjectId: string;
  year: number;
  questionCount: number;
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
