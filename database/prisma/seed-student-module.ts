/**
 * Sample data for the student module redesign (DQ Edge-style student side,
 * Examora branding). Grows phase by phase; every insert is idempotent so
 * `pnpm db:seed` can be re-run safely.
 *
 * Phase 1: XP ledger rows for the demo student, so the sidebar XP figure and
 * the Rewards page (milestone cards, progress bar) have real data.
 * Phase 2 (Learn): the "NID UG | UCEED" sample course (subjects, topics,
 * lessons, topic quizzes, heatmap numbers), licences for every student on
 * every course, and the demo student's progress and two finished quiz attempts.
 * Phase 3 (question engine): the "Rotation Practice" topic quiz (seed-question-engine.ts).
 */
import type { Prisma, PrismaClient } from "../generated/client/index.js";
import { deterministicUuid } from "./seed-id.js";
import { seedRotationQuiz } from "./seed-question-engine.js";
import { seedPracticeAndExtras } from "./seed-practice.js";
import { seedPracticeLibrary } from "./seed-practice-library.js";
import { seedDailyHistory } from "./seed-daily.js";
import { seedLiveAssignments } from "./seed-assignments-live.js";
import { seedLearnTags } from "./seed-learn-tags.js";
import {
  SAMPLE_COURSE,
  SAMPLE_PAST_PAPER_STATS,
  SAMPLE_PAST_PAPER_YEARS,
  SAMPLE_SUBJECTS,
  introLesson,
  type SampleQuiz,
} from "./seed-student-content.js";

const sid = (label: string) => deterministicUuid("examora-student-module-seed", label);

// ---------------------------------------------------------------------------
// Phase 2: Learn sample course
// ---------------------------------------------------------------------------

const courseId = sid(`course:${SAMPLE_COURSE.key}`);
const subjectId = (s: string) => sid(`subject:${s}`);
const topicId = (s: string, t: string) => sid(`topic:${s}/${t}`);
const moduleId = (s: string, t: string) => sid(`module:${s}/${t}`);
const lessonId = (s: string, t: string, l: string) => sid(`lesson:${s}/${t}/${l}`);
const quizId = (q: string) => sid(`quiz:${q}`);
const questionId = (q: string, i: number) => sid(`question:${q}/${i}`);
const optionId = (q: string, i: number, o: number) => sid(`option:${q}/${i}/${o}`);

async function seedLearnCourse(prisma: PrismaClient, adminId: string): Promise<void> {
  const now = new Date();
  const published = { status: "PUBLISHED" as const, publishedAt: now };

  await prisma.course.upsert({
    where: { id: courseId },
    create: {
      id: courseId,
      title: SAMPLE_COURSE.title,
      slug: SAMPLE_COURSE.slug,
      description: SAMPLE_COURSE.description,
      examType: SAMPLE_COURSE.examType,
      nextExamDate: new Date(SAMPLE_COURSE.nextExamDate),
      createdById: adminId,
      // Sorts first in the exam picker.
      position: -1,
      ...published,
    },
    update: { nextExamDate: new Date(SAMPLE_COURSE.nextExamDate), position: -1 },
  });

  const subjects: Prisma.SubjectCreateManyInput[] = [];
  const topics: Prisma.TopicCreateManyInput[] = [];
  const modules: Prisma.ModuleCreateManyInput[] = [];
  const lessons: Prisma.LessonCreateManyInput[] = [];
  const quizzes: Prisma.QuizCreateManyInput[] = [];
  const questions: Prisma.QuestionCreateManyInput[] = [];
  const options: Prisma.QuestionOptionCreateManyInput[] = [];
  const quizQuestions: Prisma.QuizQuestionCreateManyInput[] = [];

  SAMPLE_SUBJECTS.forEach((s, si) => {
    subjects.push({
      id: subjectId(s.key),
      courseId,
      title: s.title,
      slug: s.key,
      description: s.description,
      kind: s.kind,
      icon: s.icon,
      color: s.color,
      status: "PUBLISHED",
      position: si,
      createdById: adminId,
    });
    s.topics.forEach((t, ti) => {
      topics.push({
        id: topicId(s.key, t.key),
        subjectId: subjectId(s.key),
        title: t.title,
        slug: t.key,
        description: t.description ?? null,
        status: "PUBLISHED",
        position: ti,
        createdById: adminId,
      });
      modules.push({
        id: moduleId(s.key, t.key),
        topicId: topicId(s.key, t.key),
        title: "Lessons",
        slug: "lessons",
        type: "LEARNING",
        status: "PUBLISHED",
        position: 0,
        createdById: adminId,
      });
      (t.lessons ?? [introLesson(t.title)]).forEach((l, li) => {
        lessons.push({
          id: lessonId(s.key, t.key, l.key),
          moduleId: moduleId(s.key, t.key),
          title: l.title,
          slug: l.key,
          contentType: "TEXT",
          body: l.body,
          xpReward: 10,
          status: "PUBLISHED",
          position: li,
          createdById: adminId,
        });
      });
      (t.quizzes ?? []).forEach((q, qi) => {
        quizzes.push({
          id: quizId(q.key),
          subjectId: subjectId(s.key),
          topicId: topicId(s.key, t.key),
          title: q.title,
          slug: `nid-${q.key}`,
          maxAttempts: q.maxAttempts,
          xpReward: q.xpReward,
          level: q.level,
          position: qi,
          createdById: adminId,
          ...published,
        });
        q.questions.forEach((question, i) => {
          questions.push({
            id: questionId(q.key, i),
            subjectId: subjectId(s.key),
            type: "SINGLE_CHOICE",
            difficulty: q.level,
            text: question.text,
            explanation: question.explanation ?? null,
            tags: [t.key],
            status: "PUBLISHED",
            position: i,
            createdById: adminId,
          });
          question.options.forEach((text, o) =>
            options.push({
              id: optionId(q.key, i, o),
              questionId: questionId(q.key, i),
              text,
              isCorrect: o === question.correct,
              position: o,
            }),
          );
          quizQuestions.push({
            id: sid(`quiz-question:${q.key}/${i}`),
            quizId: quizId(q.key),
            questionId: questionId(q.key, i),
            marks: 1,
            position: i,
          });
        });
      });
    });
  });

  await prisma.subject.createMany({ data: subjects, skipDuplicates: true });
  await prisma.topic.createMany({ data: topics, skipDuplicates: true });
  await prisma.module.createMany({ data: modules, skipDuplicates: true });
  await prisma.lesson.createMany({ data: lessons, skipDuplicates: true });
  await prisma.question.createMany({ data: questions, skipDuplicates: true });
  await prisma.questionOption.createMany({ data: options, skipDuplicates: true });
  await prisma.quiz.createMany({ data: quizzes, skipDuplicates: true });
  await prisma.quizQuestion.createMany({ data: quizQuestions, skipDuplicates: true });

  const stats: Prisma.PastPaperStatCreateManyInput[] = [];
  for (const [examLabel, bySubject] of Object.entries(SAMPLE_PAST_PAPER_STATS)) {
    for (const [subjectKey, counts] of Object.entries(bySubject)) {
      SAMPLE_PAST_PAPER_YEARS.forEach((year, i) =>
        stats.push({
          id: sid(`past-paper:${examLabel}/${subjectKey}/${year}`),
          courseId,
          examLabel,
          subjectId: subjectId(subjectKey),
          year,
          questionCount: counts[i] ?? 0,
        }),
      );
    }
  }
  await prisma.pastPaperStat.createMany({ data: stats, skipDuplicates: true });
}

/** Licences: every published course for every STUDENT (admins assign them; nobody buys). */
async function seedLicences(prisma: PrismaClient): Promise<number> {
  const [students, courses] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null, roles: { some: { role: { name: "STUDENT" } } } },
      select: { id: true },
    }),
    prisma.course.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      select: { id: true },
    }),
  ]);
  const { count } = await prisma.enrollment.createMany({
    data: students.flatMap((u) =>
      courses.map((c) => ({
        userId: u.id,
        courseId: c.id,
        status: "ACTIVE" as const,
        source: "ADMIN_GRANT" as const,
      })),
    ),
    skipDuplicates: true,
  });
  return count;
}

/** The demo student's Learn progress: some topics complete, some part-way. */
async function seedLearnProgress(prisma: PrismaClient, studentId: string): Promise<void> {
  const done: [string, string, string][] = [
    ["mental-ability", "blood-relations", "family-tree"],
    ["mental-ability", "blood-relations", "coded"],
    ["mental-ability", "odd-one-out", "intro"],
    ["mental-ability", "direction-sense", "intro"],
    ...["examples", "basics", "clock", "logic", "number"].map(
      (l) => ["mental-ability", "puzzles", l] as [string, string, string],
    ),
    ["general-knowledge", "av-terminology", "audio"],
    ["general-knowledge", "av-terminology", "video"],
    ["general-knowledge", "av-terminology", "formats"],
    ["general-knowledge", "famous-designers", "intro"],
    ["visual-spatial", "rotation", "intro"],
  ];
  const now = Date.now();
  await prisma.lessonProgress.createMany({
    data: done.map(([s, t, l], i) => {
      const at = new Date(now - (done.length - i) * 86_400_000);
      return {
        id: sid(`progress:${s}/${t}/${l}`),
        userId: studentId,
        lessonId: lessonId(s, t, l),
        courseId,
        firstViewedAt: at,
        lastViewedAt: at,
        completedAt: at,
      };
    }),
    skipDuplicates: true,
  });

  await seedFinishedAttempt(prisma, studentId, "clock-puzzles", [true, true, true, false, true], 9);
  await seedFinishedAttempt(
    prisma,
    studentId,
    "av-terminology-quiz",
    [true, true, false, true, false, true, false, true, true, false],
    4,
  );
  await seedFinishedAttempt(prisma, studentId, "blood-relations-quiz", [true, true, true, true], 7);
}

/** A finished attempt where each question is answered correctly or with the next (wrong) option. */
async function seedFinishedAttempt(
  prisma: PrismaClient,
  studentId: string,
  quizKey: string,
  correct: boolean[],
  daysAgo: number,
): Promise<void> {
  const quiz = SAMPLE_SUBJECTS.flatMap((s) => s.topics.flatMap((t) => t.quizzes ?? [])).find(
    (q: SampleQuiz) => q.key === quizKey,
  )!;
  const attemptId = sid(`attempt:${quizKey}/1`);
  const exists = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true },
  });
  if (exists) return;

  const total = quiz.questions.length;
  const right = correct.filter(Boolean).length;
  const startedAt = new Date(Date.now() - daysAgo * 86_400_000);
  const submittedAt = new Date(startedAt.getTime() + total * 45_000);
  const percentage = Math.round((right / total) * 10000) / 100;

  await prisma.quizAttempt.create({
    data: {
      id: attemptId,
      quizId: quizId(quizKey),
      userId: studentId,
      status: "SUBMITTED",
      questionSnapshot: quiz.questions.map((_, i) => ({
        questionId: questionId(quizKey, i),
        sectionId: null,
        marks: 1,
      })),
      optionOrder: Object.fromEntries(
        quiz.questions.map((q, i) => [
          questionId(quizKey, i),
          q.options.map((_, o) => optionId(quizKey, i, o)),
        ]),
      ),
      passingScorePercent: 40,
      negativeMarkingEnabled: false,
      negativeMarksPerWrong: 0,
      totalMarks: total,
      startedAt,
      submittedAt,
      obtainedMarks: right,
      percentage,
      passed: percentage >= 40,
      correctCount: right,
      wrongCount: total - right,
      unansweredCount: 0,
      answers: {
        create: quiz.questions.map((q, i) => {
          const pick = correct[i] ? q.correct : (q.correct + 1) % q.options.length;
          return {
            questionId: questionId(quizKey, i),
            selectedOptionIds: [optionId(quizKey, i, pick)],
            isCorrect: correct[i] ?? false,
            marksAwarded: correct[i] ? 1 : 0,
            answeredAt: submittedAt,
          };
        }),
      },
    },
  });
}

export interface StudentModuleSeedIds {
  studentId: string;
  adminId: string;
  mentorId: string;
}

async function seedXp(prisma: PrismaClient, { studentId }: StudentModuleSeedIds): Promise<number> {
  // 1,235 XP in total: past the 1000 card, 1,265 XP short of the 2500 card.
  const awards: {
    label: string;
    amount: number;
    reason: string;
    sourceType: string;
    daysAgo: number;
  }[] = [
    { label: "welcome", amount: 5, reason: "WELCOME", sourceType: "Account", daysAgo: 40 },
    ...Array.from({ length: 12 }, (_, i) => ({
      label: `lesson-${i + 1}`,
      amount: 10,
      reason: "LESSON_COMPLETED",
      sourceType: "Lesson",
      daysAgo: 38 - i * 2,
    })),
    {
      label: "topic-quiz-1",
      amount: 20,
      reason: "QUIZ_COMPLETED",
      sourceType: "Quiz",
      daysAgo: 30,
    },
    {
      label: "topic-quiz-1",
      amount: 20,
      reason: "QUIZ_PERFECT_BONUS",
      sourceType: "Quiz",
      daysAgo: 30,
    },
    {
      label: "topic-quiz-2",
      amount: 20,
      reason: "QUIZ_COMPLETED",
      sourceType: "Quiz",
      daysAgo: 22,
    },
    {
      label: "mock-test-1",
      amount: 100,
      reason: "TEST_COMPLETED",
      sourceType: "Quiz",
      daysAgo: 20,
    },
    {
      label: "mock-test-2",
      amount: 100,
      reason: "TEST_COMPLETED",
      sourceType: "Quiz",
      daysAgo: 12,
    },
    {
      label: "past-paper-2023",
      amount: 300,
      reason: "TEST_COMPLETED",
      sourceType: "Quiz",
      daysAgo: 8,
    },
    {
      label: "past-paper-2024",
      amount: 300,
      reason: "TEST_COMPLETED",
      sourceType: "Quiz",
      daysAgo: 5,
    },
    {
      label: "predicted-set-1",
      amount: 50,
      reason: "TEST_COMPLETED",
      sourceType: "Quiz",
      daysAgo: 3,
    },
    {
      label: "predicted-set-2",
      amount: 50,
      reason: "TEST_COMPLETED",
      sourceType: "Quiz",
      daysAgo: 2,
    },
    ...Array.from({ length: 5 }, (_, i) => ({
      label: `daily-${i + 1}`,
      amount: 30,
      reason: "DAILY_QUIZ",
      sourceType: "DailyQuiz",
      daysAgo: 6 - i,
    })),
  ];
  const now = Date.now();
  const { count } = await prisma.xpEvent.createMany({
    data: awards.map((a) => ({
      id: sid(`xp:${a.reason}:${a.label}`),
      userId: studentId,
      amount: a.amount,
      reason: a.reason,
      sourceType: a.sourceType,
      sourceId: sid(`source:${a.label}`),
      createdAt: new Date(now - a.daysAgo * 86_400_000),
    })),
    skipDuplicates: true,
  });
  return count;
}

export async function seedStudentModule(
  prisma: PrismaClient,
  ids: StudentModuleSeedIds,
): Promise<void> {
  const xpRows = await seedXp(prisma, ids);
  await seedLearnCourse(prisma, ids.adminId);
  const licences = await seedLearnLicencesAndProgress(prisma, ids.studentId);
  const rotation = await seedRotationQuiz(prisma, ids.adminId);
  const extras = await seedPracticeAndExtras(prisma, ids);
  const library = await seedPracticeLibrary(prisma, ids);
  const daily = await seedDailyHistory(prisma, ids.studentId);
  const live = await seedLiveAssignments(prisma, ids.studentId, ids.mentorId);
  const tags = await seedLearnTags(prisma, ids.studentId);
  // eslint-disable-next-line no-console -- seed script CLI output
  console.log(
    `Student module sample data: ${xpRows} new XP rows, the "${SAMPLE_COURSE.title}" course, ` +
      `${licences} new licences (every student × every course), demo-student progress; ${rotation}; ${extras}; ${library}; ${daily}; ${live}; ${tags}.`,
  );
}

async function seedLearnLicencesAndProgress(
  prisma: PrismaClient,
  studentId: string,
): Promise<number> {
  const licences = await seedLicences(prisma);
  await seedLearnProgress(prisma, studentId);
  return licences;
}
