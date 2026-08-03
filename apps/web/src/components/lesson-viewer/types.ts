export interface LessonLocation {
  subjectId: string;
  subjectTitle: string;
  topicTitle: string;
  moduleId: string;
  moduleTitle: string;
  moduleLessonIds: string[];
  moduleCompletedCount: number;
}

export interface FlatLesson {
  lessonId: string;
  title: string;
}

export type LessonAccessState = "checking" | "granted" | "locked" | "not-found";
