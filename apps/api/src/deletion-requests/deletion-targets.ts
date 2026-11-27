import { Injectable, NotFoundException } from "@nestjs/common";
import type { DeletionTargetType } from "@examora/types";
import { QuestionsService } from "../assessment/question-bank/questions.service";
import { QuizzesService } from "../assessment/quizzes/quizzes.service";
import { AssignmentsAdminService } from "../assignments/authoring/assignments-admin.service";
import { TemplatesService } from "../assignments/templates/templates.service";
import { CollegesService } from "../colleges/colleges.service";
import { CategoriesService } from "../content/categories/categories.service";
import { CoursesService } from "../content/courses/courses.service";
import { LessonsService } from "../content/lessons/lessons.service";
import { ModulesService } from "../content/modules/modules.service";
import { SubjectsService } from "../content/subjects/subjects.service";
import { TopicsService } from "../content/topics/topics.service";
import { PracticeService } from "../practice/practice.service";
import { PrismaService } from "../prisma/prisma.service";
import { SketchWorksService } from "../sketches/sketch-works.service";
import { StudentProfileService } from "../student-profile/student-profile.service";

type Impact = { label: string; count: number }[];

interface TargetHandler {
  /** Display name; null when the record doesn't exist (or is already deleted). */
  label(id: string): Promise<string | null>;
  impact(id: string): Promise<Impact>;
  /** The same deletion the admin endpoint performs. */
  remove(id: string): Promise<void>;
}

const short = (s: string, n = 80) => {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
};
const live = { deletedAt: null };

/**
 * Per record type: its name, what deleting it would affect, and the real
 * delete (each module's own service, so its rules still apply).
 */
@Injectable()
export class DeletionTargets {
  private readonly handlers: Record<DeletionTargetType, TargetHandler>;

  constructor(
    private readonly prisma: PrismaService,
    categories: CategoriesService,
    courses: CoursesService,
    subjects: SubjectsService,
    topics: TopicsService,
    modules: ModulesService,
    lessons: LessonsService,
    questions: QuestionsService,
    quizzes: QuizzesService,
    assignments: AssignmentsAdminService,
    templates: TemplatesService,
    practice: PracticeService,
    sketchWorks: SketchWorksService,
    profile: StudentProfileService,
    colleges: CollegesService,
  ) {
    const p = this.prisma;
    this.handlers = {
      category: {
        label: async (id) =>
          (await p.category.findFirst({ where: { id, ...live }, select: { name: true } }))?.name ??
          null,
        impact: async (id) => [
          {
            label: "Courses in it",
            count: await p.course.count({ where: { categoryId: id, ...live } }),
          },
        ],
        remove: (id) => categories.remove(id),
      },
      course: {
        label: async (id) =>
          (await p.course.findFirst({ where: { id, ...live }, select: { title: true } }))?.title ??
          null,
        impact: async (id) => [
          { label: "Subjects", count: await p.subject.count({ where: { courseId: id, ...live } }) },
          {
            label: "Student licences",
            count: await p.enrollment.count({ where: { courseId: id, status: "ACTIVE" } }),
          },
          { label: "Batches", count: await p.cohort.count({ where: { courseId: id } }) },
        ],
        remove: (id) => courses.remove(id),
      },
      subject: {
        label: async (id) =>
          (await p.subject.findFirst({ where: { id, ...live }, select: { title: true } }))?.title ??
          null,
        impact: async (id) => [
          { label: "Topics", count: await p.topic.count({ where: { subjectId: id, ...live } }) },
          {
            label: "Quizzes and tests",
            count: await p.quiz.count({ where: { subjectId: id, ...live } }),
          },
          {
            label: "Questions",
            count: await p.question.count({ where: { subjectId: id, ...live } }),
          },
        ],
        remove: (id) => subjects.remove(id),
      },
      topic: {
        label: async (id) =>
          (await p.topic.findFirst({ where: { id, ...live }, select: { title: true } }))?.title ??
          null,
        impact: async (id) => [
          { label: "Modules", count: await p.module.count({ where: { topicId: id, ...live } }) },
          { label: "Quizzes", count: await p.quiz.count({ where: { topicId: id, ...live } }) },
          {
            label: "Questions tagged",
            count: await p.question.count({ where: { topicId: id, ...live } }),
          },
        ],
        remove: (id) => topics.remove(id),
      },
      module: {
        label: async (id) =>
          (await p.module.findFirst({ where: { id, ...live }, select: { title: true } }))?.title ??
          null,
        impact: async (id) => [
          { label: "Lessons", count: await p.lesson.count({ where: { moduleId: id, ...live } }) },
        ],
        remove: (id) => modules.remove(id),
      },
      lesson: {
        label: async (id) =>
          (await p.lesson.findFirst({ where: { id, ...live }, select: { title: true } }))?.title ??
          null,
        impact: async (id) => [
          {
            label: "Students who completed it",
            count: await p.lessonProgress.count({
              where: { lessonId: id, completedAt: { not: null } },
            }),
          },
        ],
        remove: (id) => lessons.remove(id),
      },
      question: {
        label: async (id) => {
          const q = await p.question.findFirst({ where: { id, ...live }, select: { text: true } });
          return q ? short(q.text) : null;
        },
        impact: async (id) => [
          {
            label: "Used in quizzes",
            count: await p.quizQuestion.count({ where: { questionId: id } }),
          },
          {
            label: "Student answers",
            count: await p.quizAttemptAnswer.count({ where: { questionId: id } }),
          },
        ],
        remove: (id) => questions.remove(id),
      },
      quiz: {
        label: async (id) =>
          (await p.quiz.findFirst({ where: { id, ...live }, select: { title: true } }))?.title ??
          null,
        impact: async (id) => [
          { label: "Questions", count: await p.quizQuestion.count({ where: { quizId: id } }) },
          {
            label: "Student attempts",
            count: await p.quizAttempt.count({ where: { quizId: id } }),
          },
        ],
        remove: (id) => quizzes.remove(id),
      },
      assignment: {
        label: async (id) =>
          (await p.assignment.findFirst({ where: { id, ...live }, select: { title: true } }))
            ?.title ?? null,
        impact: async (id) => [
          {
            label: "Submissions",
            count: await p.assignmentSubmission.count({ where: { assignmentId: id } }),
          },
        ],
        remove: (id) => assignments.remove(id),
      },
      "assignment-template": {
        label: async (id) =>
          (
            await p.assignmentTemplate.findFirst({
              where: { id, ...live },
              select: { title: true },
            })
          )?.title ?? null,
        impact: async () => [],
        remove: (id) => templates.remove(id),
      },
      "practice-category": {
        label: async (id) =>
          (await p.practiceCategory.findUnique({ where: { id }, select: { title: true } }))
            ?.title ?? null,
        impact: async (id) => [
          {
            label: "Tests in it",
            count: await p.quiz.count({ where: { practiceCategoryId: id, ...live } }),
          },
        ],
        remove: (id) => practice.deleteCategory(id),
      },
      rubric: {
        label: async (id) =>
          (await p.sketchRubric.findUnique({ where: { id }, select: { title: true } }))?.title ??
          null,
        impact: async (id) => [
          {
            label: "Sketch questions using it",
            count: await p.question.count({ where: { rubricId: id } }),
          },
        ],
        remove: async (id) => {
          await sketchWorks.deleteRubric(id);
        },
      },
      checkpoint: {
        label: async (id) =>
          (await p.courseCheckpoint.findUnique({ where: { id }, select: { title: true } }))
            ?.title ?? null,
        impact: async () => [],
        remove: (id) => profile.deleteCheckpoint(id),
      },
      college: {
        label: async (id) =>
          (await p.college.findUnique({ where: { id }, select: { name: true } }))?.name ?? null,
        impact: async (id) => [
          {
            label: "Shortlists",
            count: await p.collegeShortlist.count({ where: { collegeId: id } }),
          },
          { label: "Enquiries", count: await p.collegeEnquiry.count({ where: { collegeId: id } }) },
          { label: "Webinars", count: await p.webinar.count({ where: { collegeId: id } }) },
        ],
        remove: (id) => colleges.deleteCollege(id),
      },
      webinar: {
        label: async (id) =>
          (await p.webinar.findUnique({ where: { id }, select: { title: true } }))?.title ?? null,
        impact: async (id) => [
          {
            label: "Registrations",
            count: await p.webinarRegistration.count({ where: { webinarId: id } }),
          },
        ],
        remove: (id) => colleges.deleteWebinar(id),
      },
      batch: {
        label: async (id) =>
          (await p.cohort.findUnique({ where: { id }, select: { name: true } }))?.name ?? null,
        impact: async (id) => [
          { label: "Students", count: await p.cohortMember.count({ where: { cohortId: id } }) },
          { label: "Mentors", count: await p.cohortMentor.count({ where: { cohortId: id } }) },
        ],
        remove: (id) => profile.deleteCohort(id),
      },
    };
  }

  handler(type: DeletionTargetType): TargetHandler {
    return this.handlers[type];
  }

  async describe(type: DeletionTargetType, id: string): Promise<{ label: string; impact: Impact }> {
    const h = this.handler(type);
    const label = await h.label(id);
    if (label === null)
      throw new NotFoundException("That record doesn't exist (or is already deleted)");
    return { label, impact: (await h.impact(id)).filter((i) => i.count > 0) };
  }
}
