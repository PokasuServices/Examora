import type { Curriculum, LessonWithProgress } from "@examora/types";
import { toCourse, toLesson, toModule, toSubject, toTopic } from "../content/content.mappers";
import type { CatalogService } from "./catalog.service";

type ProgressEntry = { completedAt: Date | null; lastViewedAt: Date };

function toLessonWithProgress(
  lesson: Parameters<typeof toLesson>[0],
  progress: ProgressEntry | undefined,
): LessonWithProgress {
  return {
    ...toLesson(lesson),
    completed: progress?.completedAt != null,
    lastViewedAt: progress?.lastViewedAt ? progress.lastViewedAt.toISOString() : null,
  };
}

type CurriculumResult = Awaited<ReturnType<CatalogService["getCurriculum"]>>;

/** Builds the nested published curriculum DTO with per-lesson progress + totals. */
export function toCurriculum({ course, progressByLesson }: CurriculumResult): Curriculum {
  let totalLessons = 0;
  let completedLessons = 0;

  const subjects = course.subjects.map((subject) => ({
    ...toSubject(subject),
    topics: subject.topics.map((topic) => ({
      ...toTopic(topic),
      modules: topic.modules.map((mod) => ({
        ...toModule(mod),
        lessons: mod.lessons.map((lesson) => {
          const progress = progressByLesson.get(lesson.id);
          totalLessons += 1;
          if (progress?.completedAt != null) {
            completedLessons += 1;
          }
          return toLessonWithProgress(lesson, progress);
        }),
      })),
    })),
  }));

  return { ...toCourse(course), subjects, totalLessons, completedLessons };
}

type LessonResult = Awaited<ReturnType<CatalogService["getLessonForStudent"]>>;

export function toStudentLesson({ lesson, progress }: LessonResult): LessonWithProgress {
  return toLessonWithProgress(lesson, progress ?? undefined);
}
