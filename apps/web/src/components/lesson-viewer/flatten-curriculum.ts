import type { Curriculum } from "@examora/types";
import type { FlatLesson, LessonLocation } from "./types";

/** Lessons in curriculum (reading) order — subjects/topics/modules are already position-sorted by the API. */
export function flattenLessons(curriculum: Curriculum): FlatLesson[] {
  return curriculum.subjects
    .flatMap((s) => s.topics)
    .flatMap((t) => t.modules)
    .flatMap((m) => m.lessons)
    .map((l) => ({ lessonId: l.id, title: l.title }));
}

/** Where a lesson sits in the tree — used for the breadcrumb and the module-progress rollup. */
export function locateLesson(curriculum: Curriculum, lessonId: string): LessonLocation | null {
  for (const subject of curriculum.subjects) {
    for (const topic of subject.topics) {
      for (const mod of topic.modules) {
        if (mod.lessons.some((l) => l.id === lessonId)) {
          return {
            subjectId: subject.id,
            subjectTitle: subject.title,
            topicTitle: topic.title,
            moduleId: mod.id,
            moduleTitle: mod.title,
            moduleLessonIds: mod.lessons.map((l) => l.id),
            moduleCompletedCount: mod.lessons.filter((l) => l.completed).length,
          };
        }
      }
    }
  }
  return null;
}
