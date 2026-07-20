import type { Course, Lesson, Module, Subject, Topic } from "./content";

/** A lesson as seen by a student, with their own progress flags attached. */
export interface LessonWithProgress extends Lesson {
  completed: boolean;
  lastViewedAt: string | null;
}

/** Full published curriculum tree for a course (published nodes only). */
export interface CurriculumModule extends Module {
  lessons: LessonWithProgress[];
}
export interface CurriculumTopic extends Topic {
  modules: CurriculumModule[];
}
export interface CurriculumSubject extends Subject {
  topics: CurriculumTopic[];
}
export interface Curriculum extends Course {
  subjects: CurriculumSubject[];
  totalLessons: number;
  completedLessons: number;
}

/** Per-course progress summary for the student dashboard. */
export interface CourseProgress {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  totalLessons: number;
  completedLessons: number;
  percentComplete: number;
  lastActivityAt: string | null;
  nextLesson: { id: string; title: string } | null;
}

/** A recently-viewed lesson entry. */
export interface RecentLesson {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  completed: boolean;
  lastViewedAt: string;
}

/** The student learning dashboard payload. */
export interface LearningDashboard {
  continueLearning: CourseProgress[];
  recentlyViewed: RecentLesson[];
  stats: {
    coursesStarted: number;
    coursesCompleted: number;
    lessonsCompleted: number;
  };
}

/** Admin read-only per-course progress aggregate. */
export interface AdminCourseProgress {
  courseId: string;
  courseTitle: string;
  totalPublishedLessons: number;
  learnerCount: number;
  completedLearnerCount: number;
  totalLessonCompletions: number;
}
