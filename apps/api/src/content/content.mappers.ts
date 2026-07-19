import type {
  Category as CategoryDto,
  Course as CourseDto,
  Lesson as LessonDto,
  Module as ModuleDto,
  Subject as SubjectDto,
  Topic as TopicDto,
} from "@examora/types";
import type { Category, Course, Lesson, Module, Subject, Topic } from "@examora/database";

export function toCategory(row: Category): CategoryDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: row.isActive,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCourse(row: Course): CourseDto {
  return {
    id: row.id,
    categoryId: row.categoryId,
    title: row.title,
    slug: row.slug,
    description: row.description,
    examType: row.examType,
    status: row.status,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSubject(row: Subject): SubjectDto {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    slug: row.slug,
    description: row.description,
    status: row.status,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTopic(row: Topic): TopicDto {
  return {
    id: row.id,
    subjectId: row.subjectId,
    title: row.title,
    slug: row.slug,
    description: row.description,
    status: row.status,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toModule(row: Module): ModuleDto {
  return {
    id: row.id,
    topicId: row.topicId,
    title: row.title,
    slug: row.slug,
    description: row.description,
    type: row.type,
    status: row.status,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toLesson(row: Lesson): LessonDto {
  return {
    id: row.id,
    moduleId: row.moduleId,
    title: row.title,
    slug: row.slug,
    contentType: row.contentType,
    body: row.body,
    contentUrl: row.contentUrl,
    durationMinutes: row.durationMinutes,
    status: row.status,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
