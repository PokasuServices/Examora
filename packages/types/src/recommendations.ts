/**
 * AI Recommendation Engine DTOs (Sprint 11, ADR-0021). Every recommendation
 * is a deterministic, rule-based score over existing platform data — no
 * external AI services, no persistence of results (ADR-0021 §1/§5). Every
 * item carries `score` (0-100) and `reason` (plain-English explanation) so
 * results are always explainable.
 */

export const RECOMMENDATION_TYPES = [
  "COURSE",
  "SIMILAR_COURSES",
  "LEARNING_PATH",
  "CONTINUE_LEARNING",
  "QUIZ",
  "ASSIGNMENT",
  "COMMUNITY_DISCUSSION",
] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export interface CourseRecommendation {
  courseId: string;
  courseTitle: string;
  categoryId: string | null;
  categoryName: string | null;
  score: number;
  reason: string;
}

export interface SimilarCourseRecommendation {
  courseId: string;
  courseTitle: string;
  referenceCourseId: string;
  referenceCourseTitle: string;
  score: number;
  reason: string;
}

export interface LearningPathStep {
  courseId: string;
  courseTitle: string;
  order: number;
  score: number;
  reason: string;
}

export interface ContinueLearningItem {
  courseId: string;
  courseTitle: string;
  completionPercent: number;
  nextLesson: { id: string; title: string } | null;
  lastActivityAt: string | null;
  score: number;
  reason: string;
}

export interface QuizRecommendation {
  quizId: string;
  quizTitle: string;
  subjectId: string | null;
  subjectTitle: string | null;
  score: number;
  reason: string;
}

export interface AssignmentRecommendation {
  assignmentId: string;
  assignmentTitle: string;
  subjectId: string | null;
  subjectTitle: string | null;
  score: number;
  reason: string;
}

export interface RelatedDiscussionRecommendation {
  threadId: string;
  threadTitle: string;
  boardId: string;
  score: number;
  reason: string;
}

export interface RecommendationFeatureFlagDto {
  type: RecommendationType;
  isEnabled: boolean;
  updatedByEmail: string | null;
  updatedAt: string | null;
}

export interface SetRecommendationFeatureFlagInput {
  isEnabled: boolean;
}
