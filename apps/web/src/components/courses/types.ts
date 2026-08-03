import type { Course } from "@examora/types";

/**
 * The five states a catalog card can actually be in, derived from real data
 * (Enrollment + CourseCompletionEntry) — never inferred or guessed.
 *
 * - "locked": paid course, no active Enrollment — must purchase to access.
 * - "not-started": accessible (free, or owned) but no progress recorded yet.
 * - "in-progress": 0% < completion < 100%.
 * - "completed": completion === 100%.
 */
export type CourseStatus = "locked" | "not-started" | "in-progress" | "completed";

export interface EnrichedCourse {
  course: Course;
  status: CourseStatus;
  completionPercent: number | null;
  /** Plain-English reason from the recommendation engine, when this course was recommended. */
  recommendedReason: string | null;
  recentlyViewedAt: string | null;
}

export type PriceFilter = "all" | "free" | "paid";
export type StatusFilter = "all" | "purchased" | "in-progress" | "completed" | "not-started";
export type SortOption = "featured" | "title-asc" | "price-asc" | "price-desc" | "newest";
export type QuickFilter = "all" | "continue" | "recommended" | "recent";
