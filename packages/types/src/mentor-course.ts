/**
 * Mentor course progress: a mentor picks a course their assigned students are
 * licensed for and sees each student's lessons, tests and assignments in it.
 */

/** A course at least one of the mentor's current students holds an active licence for. */
export interface MentorCourseOption {
  id: string;
  title: string;
  /** The mentor's current students licensed for this course. */
  studentCount: number;
}

export interface MentorCourseStudentRow {
  studentId: string;
  name: string;
  email: string;
  lessonsCompleted: number;
  /** Lessons completed as a percent of the course's published lessons. */
  completionPercent: number;
  /** Different tests (quizzes) finished at least once. */
  testsTaken: number;
  /** Average percent over all finished attempts in the course, or null if none. */
  testAveragePercent: number | null;
  /** Latest submission per assignment, by state. */
  assignments: {
    notStarted: number;
    draft: number;
    awaitingReview: number;
    revisionRequested: number;
    approved: number;
  };
  /** Most recent lesson, test or assignment activity in this course. */
  lastActiveAt: string | null;
}

export interface MentorCourseAssignmentRow {
  id: string;
  title: string;
  deadline: string | null;
  notStarted: number;
  draft: number;
  awaitingReview: number;
  revisionRequested: number;
  approved: number;
}

export interface MentorCourseProgress {
  course: {
    id: string;
    title: string;
    lessonCount: number;
    testCount: number;
    assignmentCount: number;
  };
  students: MentorCourseStudentRow[];
  assignments: MentorCourseAssignmentRow[];
}
