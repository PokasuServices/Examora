export type AccessState = "checking" | "granted" | "locked";
export type PurchaseState = "idle" | "starting" | "confirming" | "failed";

/**
 * Real per-subject rollup — Quiz/Assignment only classify under a Subject in
 * the schema (no moduleId/lessonId), so "Quiz Indicators" / "Assignment
 * Indicators" can only be shown at the subject level, not per-lesson.
 */
export interface SubjectStats {
  subjectId: string;
  totalLessons: number;
  completedLessons: number;
  quizCount: number;
  assignmentCount: number;
}
