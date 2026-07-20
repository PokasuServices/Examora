import type { ContentStatus } from "@examora/types";
import type { PrismaService } from "../../src/prisma/prisma.service";

export interface SeededCourseTree {
  courseId: string;
  subjectId: string;
  topicId: string;
  moduleId: string;
  lessonIds: string[];
  draftLessonId: string;
  cleanup: () => Promise<void>;
}

/**
 * Seeds a fully-PUBLISHED Category > Course > Subject > Topic > Module tree with
 * `publishedLessons` published lessons plus one DRAFT lesson, directly via
 * Prisma (bypasses the content services so learning tests are self-contained).
 */
export async function seedPublishedCourseTree(
  prisma: PrismaService,
  opts: { publishedLessons?: number; courseStatus?: ContentStatus } = {},
): Promise<SeededCourseTree> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const published = { status: "PUBLISHED" as ContentStatus };

  const category = await prisma.category.create({
    data: { name: `seed-cat-${suffix}`, slug: `seed-cat-${suffix}` },
  });
  const course = await prisma.course.create({
    data: {
      categoryId: category.id,
      title: `seed-course-${suffix}`,
      slug: `seed-course-${suffix}`,
      status: opts.courseStatus ?? "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  const subject = await prisma.subject.create({
    data: { courseId: course.id, title: "Subject", slug: `subject-${suffix}`, ...published },
  });
  const topic = await prisma.topic.create({
    data: { subjectId: subject.id, title: "Topic", slug: `topic-${suffix}`, ...published },
  });
  const mod = await prisma.module.create({
    data: { topicId: topic.id, title: "Module", slug: `module-${suffix}`, ...published },
  });

  const count = opts.publishedLessons ?? 2;
  const lessonIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const lesson = await prisma.lesson.create({
      data: {
        moduleId: mod.id,
        title: `Lesson ${i + 1}`,
        slug: `lesson-${i + 1}-${suffix}`,
        position: i,
        body: `body ${i + 1}`,
        ...published,
      },
    });
    lessonIds.push(lesson.id);
  }

  const draftLesson = await prisma.lesson.create({
    data: {
      moduleId: mod.id,
      title: "Draft Lesson",
      slug: `draft-lesson-${suffix}`,
      position: count,
      status: "DRAFT",
    },
  });

  return {
    courseId: course.id,
    subjectId: subject.id,
    topicId: topic.id,
    moduleId: mod.id,
    lessonIds,
    draftLessonId: draftLesson.id,
    cleanup: async () => {
      // Course delete cascades to subjects→topics→modules→lessons→progress;
      // the category is SetNull on course, so remove it separately.
      await prisma.course.deleteMany({ where: { id: course.id } });
      await prisma.category.deleteMany({ where: { id: category.id } });
    },
  };
}
