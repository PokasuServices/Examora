import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  DailyCalendarView,
  DailyScheduleInput,
  DailyScheduleItem,
  DuplicateMatch,
  ImportPreview,
  ImportResult,
  QuestionType,
} from "@examora/types";
import type { RequestUser } from "../auth/types/request-user";
import { PrismaService } from "../prisma/prisma.service";
import { SketchesService } from "../sketches/sketches.service";
import { StaffScopeService, type StaffScope } from "../staff/staff-scope.service";
import { DeskNotifier } from "./desk-notifier.service";
import { addDays, isoDay, parseDay, personName, todayIndia, USER_NAME_SELECT } from "./desk-util";
import { ExcelService, type SheetColumn } from "./excel.service";

const DAILY_MIN = 5;
const DAILY_MAX = 15;
const DUPLICATE_AT = 70;

/** Lowercase words without punctuation, for similarity. */
function normalize(t: string): string {
  return t
    .toLowerCase()
    .replace(/\$[^$]*\$/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Dice coefficient on character bigrams, 0–100. */
export function similarity(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 100;
  const bx = bigrams(x);
  const by = bigrams(y);
  let overlap = 0;
  for (const [g, n] of bx) overlap += Math.min(n, by.get(g) ?? 0);
  const total = Math.max(1, x.length - 1 + (y.length - 1));
  return Math.round((2 * overlap * 100) / total);
}

const TYPE_FROM: Record<string, QuestionType> = {
  "single choice": "SINGLE_CHOICE",
  single: "SINGLE_CHOICE",
  mcq: "SINGLE_CHOICE",
  "multiple choice": "MULTIPLE_CHOICE",
  multiple: "MULTIPLE_CHOICE",
  "true or false": "TRUE_FALSE",
  "true/false": "TRUE_FALSE",
  "true false": "TRUE_FALSE",
  numeric: "NUMERIC",
  number: "NUMERIC",
  "sketch upload": "UPLOAD",
  sketch: "UPLOAD",
  upload: "UPLOAD",
};
const DIFF_FROM: Record<string, "EASY" | "MEDIUM" | "HARD"> = {
  easy: "EASY",
  medium: "MEDIUM",
  hard: "HARD",
};

export const QUESTION_COLUMNS: SheetColumn[] = [
  {
    key: "type",
    header: "Type",
    width: 16,
    required: true,
    options: ["Single choice", "Multiple choice", "True or false", "Numeric", "Sketch upload"],
  },
  { key: "text", header: "Question", width: 60, required: true },
  { key: "a", header: "Option A", width: 22 },
  { key: "b", header: "Option B", width: 22 },
  { key: "c", header: "Option C", width: 22 },
  { key: "d", header: "Option D", width: 22 },
  {
    key: "correct",
    header: "Correct answer",
    width: 16,
    required: true,
    note: "A/B/C/D; several for multiple choice (A,C); True/False; a number or range (10-12); blank for sketches",
  },
  { key: "marks", header: "Marks", width: 8 },
  { key: "difficulty", header: "Difficulty", width: 11, options: ["Easy", "Medium", "Hard"] },
  { key: "topic", header: "Topic", width: 24, note: "Topic title in this course (optional)" },
  { key: "explanation", header: "Explanation", width: 50 },
  { key: "explanationVideoUrl", header: "Explanation video URL", width: 30 },
  { key: "explanationImageUrl", header: "Explanation image URL", width: 30 },
];

const QUESTION_HELP = [
  "One question per row. Type decides which columns are used.",
  "Single choice: fill Option A–D and put the right letter in Correct answer (e.g. B).",
  "Multiple choice: put every right letter, separated by commas (e.g. A,C).",
  "True or false: leave the options blank and write True or False.",
  "Numeric: write the exact answer (12.5) or an accepted range (12-13).",
  "Sketch upload: leave options and Correct answer blank; a mentor marks it.",
  "Explanation can be text; add a video or image link for richer explanations.",
  "Before saving, Examora checks for questions that already exist and warns you.",
];

type ParsedQuestion = {
  row: number;
  type: QuestionType;
  text: string;
  options: { text: string; isCorrect: boolean }[];
  numericMin: number | null;
  numericMax: number | null;
  marks: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  topic: string;
  explanation: string | null;
  explanationVideoUrl: string | null;
  explanationImageUrl: string | null;
  values: Record<string, string>;
};

/**
 * Mentor quiz tools: the course's daily quiz calendar, publishing a quiz to
 * batches, the duplicate-question check, and Excel upload of questions and
 * of sketch marks given offline.
 */
@Injectable()
export class QuizToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: StaffScopeService,
    private readonly excel: ExcelService,
    private readonly sketches: SketchesService,
    private readonly notify: DeskNotifier,
  ) {}

  // ------------------------------------------------------------ daily calendar

  private item(
    r: {
      id: string;
      courseId: string;
      date: Date;
      title: string;
      questionIds: unknown;
      createdBy: { id: string; email: string; firstName: string | null; lastName: string | null };
    },
    actorId: string,
    movedFrom?: string,
  ): DailyScheduleItem {
    return {
      id: r.id,
      courseId: r.courseId,
      date: isoDay(r.date),
      title: r.title,
      questionIds: (r.questionIds as string[]) ?? [],
      createdBy: { id: r.createdBy.id, name: personName(r.createdBy) },
      mine: r.createdBy.id === actorId,
      ...(movedFrom ? { movedFrom } : {}),
    };
  }

  async calendar(
    actor: RequestUser,
    courseId: string,
    from: string,
    to: string,
  ): Promise<DailyCalendarView> {
    await this.scope.assert(actor, "course", courseId);
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true },
    });
    if (!course) throw new NotFoundException("Course not found");
    const f = parseDay(from);
    const t = parseDay(to);
    const [rows, played] = await Promise.all([
      this.prisma.dailyQuizSchedule.findMany({
        where: { courseId, date: { gte: f, lte: t } },
        include: { createdBy: { select: USER_NAME_SELECT } },
      }),
      this.prisma.dailyQuiz.findMany({
        where: { scope: courseId, date: { gte: f, lte: t } },
        select: { date: true, _count: { select: { attempts: true } } },
      }),
    ]);
    const days: DailyCalendarView["days"] = [];
    for (let d = f; d <= t; d = addDays(d, 1)) {
      const key = isoDay(d);
      const r = rows.find((x) => isoDay(x.date) === key);
      days.push({
        date: key,
        schedule: r ? this.item(r, actor.id) : null,
        played: played.find((p) => isoDay(p.date) === key)?._count.attempts ?? 0,
      });
    }
    return { courseId, courseTitle: course.title, from, to, days };
  }

  private async assertDailyQuestions(ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length < DAILY_MIN || unique.length > DAILY_MAX) {
      throw new BadRequestException(`A daily quiz has ${DAILY_MIN}–${DAILY_MAX} questions`);
    }
    const rows = await this.prisma.question.findMany({
      where: { id: { in: unique }, deletedAt: null },
      select: { id: true, type: true },
    });
    if (rows.length !== unique.length)
      throw new BadRequestException("Some questions no longer exist");
    if (rows.some((r) => r.type !== "SINGLE_CHOICE" && r.type !== "TRUE_FALSE")) {
      throw new BadRequestException(
        "Daily quiz questions are single choice or true/false (10 seconds each)",
      );
    }
    return unique;
  }

  /** First free day for a course on or after `from`. */
  private async freeDay(courseId: string, from: Date, exceptId?: string): Promise<Date> {
    const taken = await this.prisma.dailyQuizSchedule.findMany({
      where: {
        courseId,
        date: { gte: from, lte: addDays(from, 120) },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { date: true },
    });
    const set = new Set(taken.map((t) => isoDay(t.date)));
    let d = from;
    while (set.has(isoDay(d))) d = addDays(d, 1);
    return d;
  }

  async schedule(actor: RequestUser, input: DailyScheduleInput): Promise<DailyScheduleItem> {
    await this.scope.assert(actor, "course", input.courseId);
    const questionIds = await this.assertDailyQuestions(input.questionIds);
    const wanted = parseDay(input.date);
    const today = todayIndia();
    if (wanted < today) throw new BadRequestException("Pick today or a later date");
    if (wanted.getTime() === today.getTime()) {
      const live = await this.prisma.dailyQuiz.findUnique({
        where: { date_scope: { date: today, scope: input.courseId } },
        select: { id: true },
      });
      if (live) throw new BadRequestException("Today's quiz for this course has already started");
    }
    const date = await this.freeDay(input.courseId, wanted);
    const row = await this.prisma.dailyQuizSchedule.create({
      data: {
        courseId: input.courseId,
        date,
        title: input.title.trim() || "Daily quiz",
        questionIds,
        createdById: actor.id,
      },
      include: { createdBy: { select: USER_NAME_SELECT } },
    });
    return this.item(row, actor.id, date.getTime() !== wanted.getTime() ? input.date : undefined);
  }

  async reschedule(
    actor: RequestUser,
    id: string,
    input: { date?: string; title?: string; questionIds?: string[] },
  ): Promise<DailyScheduleItem> {
    const row = await this.prisma.dailyQuizSchedule.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Not found");
    await this.scope.assert(actor, "course", row.courseId);
    if (this.scope.isScoped(actor) && row.createdById !== actor.id) {
      throw new ForbiddenException("Only the mentor who made this quiz can change it");
    }
    const live = await this.prisma.dailyQuiz.findUnique({
      where: { date_scope: { date: row.date, scope: row.courseId } },
      select: { id: true },
    });
    if (live) throw new BadRequestException("Students have started this quiz, so it can't change");
    let date = row.date;
    let movedFrom: string | undefined;
    if (input.date) {
      const wanted = parseDay(input.date);
      if (wanted < todayIndia()) throw new BadRequestException("Pick today or a later date");
      date = await this.freeDay(row.courseId, wanted, id);
      if (date.getTime() !== wanted.getTime()) movedFrom = input.date;
    }
    const updated = await this.prisma.dailyQuizSchedule.update({
      where: { id },
      data: {
        date,
        ...(input.title !== undefined ? { title: input.title.trim() || "Daily quiz" } : {}),
        ...(input.questionIds
          ? { questionIds: await this.assertDailyQuestions(input.questionIds) }
          : {}),
      },
      include: { createdBy: { select: USER_NAME_SELECT } },
    });
    return this.item(updated, actor.id, movedFrom);
  }

  /** Single-choice / true-false questions of a course, for the daily quiz picker. */
  async dailyPool(actor: RequestUser, courseId: string, search?: string) {
    await this.scope.assert(actor, "course", courseId);
    const rows = await this.prisma.question.findMany({
      where: {
        deletedAt: null,
        type: { in: ["SINGLE_CHOICE", "TRUE_FALSE"] },
        OR: [
          { subject: { courseId } },
          { topic: { subject: { courseId } } },
          { createdById: actor.id },
        ],
        ...(search?.trim() ? { text: { contains: search.trim(), mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        text: true,
        type: true,
        difficulty: true,
        topic: { select: { title: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      text: r.text,
      type: r.type,
      difficulty: r.difficulty,
      topic: r.topic?.title ?? null,
    }));
  }

  // ------------------------------------------------------------ quiz → batches

  async quizBatches(actor: RequestUser, quizId: string) {
    await this.scope.assert(actor, "quiz", quizId);
    const s = await this.scope.scopeFor(actor);
    const [rows, cohorts] = await Promise.all([
      this.prisma.quizCohort.findMany({ where: { quizId }, select: { cohortId: true } }),
      this.prisma.cohort.findMany({
        where: { isActive: true, ...(s ? { id: { in: s.cohortIds } } : {}) },
        select: {
          id: true,
          name: true,
          course: { select: { title: true } },
          _count: { select: { members: true } },
        },
        orderBy: { name: "asc" },
      }),
    ]);
    const chosen = new Set(rows.map((r) => r.cohortId));
    return {
      everyone: chosen.size === 0,
      batches: cohorts.map((c) => ({
        id: c.id,
        name: c.name,
        courseTitle: c.course?.title ?? null,
        students: c._count.members,
        selected: chosen.has(c.id),
      })),
      /** Other batches (not mine) the quiz is already published to */
      others: [...chosen].filter((id) => !cohorts.some((c) => c.id === id)).length,
    };
  }

  async setQuizBatches(actor: RequestUser, quizId: string, cohortIds: string[]) {
    await this.scope.assert(actor, "quiz", quizId);
    const s = await this.scope.scopeFor(actor);
    if (s && cohortIds.some((id) => !s.cohortIds.includes(id))) {
      throw new ForbiddenException("You can only publish to your own batches");
    }
    const keep = s
      ? (
          await this.prisma.quizCohort.findMany({
            where: { quizId, cohortId: { notIn: s.cohortIds } },
          })
        ).map((r) => r.cohortId)
      : [];
    const before = new Set(
      (
        await this.prisma.quizCohort.findMany({ where: { quizId }, select: { cohortId: true } })
      ).map((r) => r.cohortId),
    );
    await this.prisma.$transaction([
      this.prisma.quizCohort.deleteMany({ where: { quizId } }),
      this.prisma.quizCohort.createMany({
        data: [...new Set([...keep, ...cohortIds])].map((cohortId) => ({ quizId, cohortId })),
        skipDuplicates: true,
      }),
    ]);
    const quiz = await this.prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      select: { title: true, status: true },
    });
    const added = cohortIds.filter((id) => !before.has(id));
    if (quiz.status === "PUBLISHED" && added.length) {
      const members = await this.prisma.cohortMember.findMany({
        where: { cohortId: { in: added } },
        select: { userId: true },
      });
      for (const m of new Set(members.map((x) => x.userId))) {
        await this.notify.user(
          m,
          "student.quiz_published",
          `New test: ${quiz.title}`,
          "Your mentor published a new test for your batch.",
          {
            quizId,
            url: `/quizzes/${quizId}`,
          },
        );
      }
    }
    return this.quizBatches(actor, quizId);
  }

  // ------------------------------------------------------------ duplicates

  async duplicates(
    scope: StaffScope | null,
    input: {
      text: string;
      imageUrl?: string | null;
      courseId?: string | null;
      excludeId?: string | null;
    },
  ): Promise<DuplicateMatch[]> {
    const text = input.text?.trim() ?? "";
    if (normalize(text).length < 12 && !input.imageUrl) return [];
    const courseIds = input.courseId ? [input.courseId] : (scope?.courseIds ?? null);
    const rows = await this.prisma.question.findMany({
      where: {
        deletedAt: null,
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
        ...(courseIds
          ? {
              OR: [
                { subject: { courseId: { in: courseIds } } },
                { topic: { subject: { courseId: { in: courseIds } } } },
                ...(scope ? [{ createdById: scope.userId }] : []),
              ],
            }
          : {}),
      },
      select: {
        id: true,
        text: true,
        imageUrl: true,
        quizQuestions: { select: { position: true, quiz: { select: { title: true } } }, take: 1 },
      },
      take: 5000,
    });
    return rows
      .map((r) => {
        const sameImage = !!input.imageUrl && r.imageUrl === input.imageUrl;
        const sim = sameImage ? 100 : similarity(text, r.text);
        const q = r.quizQuestions[0];
        return {
          questionId: r.id,
          text: r.text,
          similarity: sim,
          where: q ? `${q.quiz.title}, Q${q.position + 1}` : "Question bank",
        };
      })
      .filter((m) => m.similarity >= DUPLICATE_AT)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }

  // ------------------------------------------------------------ question Excel

  async questionTemplate(): Promise<Buffer> {
    return this.excel.build([
      {
        name: "Questions",
        columns: QUESTION_COLUMNS,
        rows: [
          {
            type: "Single choice",
            text: "Which colour is formed by mixing blue and yellow?",
            a: "Green",
            b: "Purple",
            c: "Orange",
            d: "Brown",
            correct: "A",
            marks: 1,
            difficulty: "Easy",
            explanation: "Blue + yellow = green (secondary colour).",
          },
        ],
        blankRows: 200,
        instructions: QUESTION_HELP,
      },
    ]);
  }

  private parseQuestion(r: Record<string, string> & { __row: string }): {
    q?: ParsedQuestion;
    error?: string;
  } {
    const row = Number(r.__row);
    const type = TYPE_FROM[(r.type ?? "").toLowerCase()];
    if (!type) return { error: `Type "${r.type ?? ""}" isn't one of the listed types` };
    const text = (r.text ?? "").trim();
    if (text.length < 3) return { error: "Question text is missing" };
    const letters = ["a", "b", "c", "d"] as const;
    const opts = letters.map((l) => (r[l] ?? "").trim());
    const correct = (r.correct ?? "").trim();
    const marks = r.marks ? Number(r.marks) : 1;
    if (!Number.isFinite(marks) || marks <= 0) return { error: "Marks must be a positive number" };
    let options: ParsedQuestion["options"] = [];
    let numericMin: number | null = null;
    let numericMax: number | null = null;
    if (type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE") {
      const filled = opts.map((t, i) => ({ t, l: letters[i]!.toUpperCase() })).filter((o) => o.t);
      if (filled.length < 2) return { error: "Give at least two options" };
      const right = correct
        .toUpperCase()
        .split(/[\s,;/]+/)
        .filter(Boolean);
      if (right.length === 0) return { error: "Correct answer is missing (e.g. B)" };
      if (right.some((x) => !filled.some((o) => o.l === x)))
        return { error: `Correct answer "${correct}" isn't a filled option` };
      if (type === "SINGLE_CHOICE" && right.length > 1)
        return { error: "Single choice has one correct letter" };
      options = filled.map((o) => ({ text: o.t, isCorrect: right.includes(o.l) }));
    } else if (type === "TRUE_FALSE") {
      const v = correct.toLowerCase();
      if (v !== "true" && v !== "false")
        return { error: "Write True or False as the correct answer" };
      options = [
        { text: "True", isCorrect: v === "true" },
        { text: "False", isCorrect: v === "false" },
      ];
    } else if (type === "NUMERIC") {
      const m = /^(-?\d+(?:\.\d+)?)(?:\s*(?:-|to)\s*(-?\d+(?:\.\d+)?))?$/.exec(correct);
      if (!m) return { error: "Numeric answers look like 12.5 or 12-13" };
      numericMin = Number(m[1]);
      numericMax = m[2] !== undefined ? Number(m[2]) : numericMin;
      if (numericMax < numericMin) [numericMin, numericMax] = [numericMax, numericMin];
    }
    return {
      q: {
        row,
        type,
        text,
        options,
        numericMin,
        numericMax,
        marks,
        difficulty: DIFF_FROM[(r.difficulty ?? "").toLowerCase()] ?? "MEDIUM",
        topic: (r.topic ?? "").trim(),
        explanation: r.explanation?.trim() || null,
        explanationVideoUrl: r.explanationVideoUrl?.trim() || null,
        explanationImageUrl: r.explanationImageUrl?.trim() || null,
        values: r,
      },
    };
  }

  /** Upload questions to a quiz (or a course's question bank) from the template. */
  async importQuestions(
    actor: RequestUser,
    target: { quizId?: string; courseId?: string },
    contentBase64: string,
    dryRun: boolean,
  ): Promise<ImportPreview | ImportResult> {
    let courseId = target.courseId ?? null;
    let subjectId: string | null = null;
    if (target.quizId) {
      await this.scope.assert(actor, "quiz", target.quizId);
      const quiz = await this.prisma.quiz.findUnique({
        where: { id: target.quizId },
        select: {
          subjectId: true,
          subject: { select: { courseId: true } },
          topic: { select: { subject: { select: { id: true, courseId: true } } } },
          practiceCategory: { select: { courseId: true } },
        },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      subjectId = quiz.subjectId ?? quiz.topic?.subject.id ?? null;
      courseId =
        quiz.subject?.courseId ??
        quiz.topic?.subject.courseId ??
        quiz.practiceCategory?.courseId ??
        courseId;
    } else if (courseId) {
      await this.scope.assert(actor, "course", courseId);
    } else {
      throw new BadRequestException("Choose a quiz or a course for the questions");
    }
    const topics = courseId
      ? await this.prisma.topic.findMany({
          where: { deletedAt: null, subject: { courseId, deletedAt: null } },
          select: { id: true, title: true, subjectId: true },
        })
      : [];
    if (!subjectId && courseId) {
      subjectId =
        (
          await this.prisma.subject.findFirst({
            where: { courseId, deletedAt: null },
            orderBy: { position: "asc" },
            select: { id: true },
          })
        )?.id ?? null;
    }
    const raw = await this.excel.read(contentBase64, QUESTION_COLUMNS);
    const parsed: ParsedQuestion[] = [];
    const issues: { row: number; message: string }[] = [];
    const warnings: { row: number; message: string }[] = [];
    const scope = await this.scope.scopeFor(actor);
    for (const r of raw) {
      const { q, error } = this.parseQuestion(r);
      if (error || !q) {
        issues.push({ row: Number(r.__row), message: error ?? "Couldn't read this row" });
        continue;
      }
      if (q.topic && !topics.some((t) => t.title.toLowerCase() === q.topic.toLowerCase())) {
        warnings.push({
          row: q.row,
          message: `Topic "${q.topic}" isn't in this course; saved without a topic`,
        });
      }
      const dup = (await this.duplicates(scope, { text: q.text, courseId }))[0];
      if (dup)
        warnings.push({
          row: q.row,
          message: `Similar question exists: ${dup.where} (${dup.similarity}% match)`,
        });
      if (parsed.some((p) => similarity(p.text, q.text) >= 95)) {
        warnings.push({ row: q.row, message: "Same question appears twice in this file" });
      }
      parsed.push(q);
    }
    if (dryRun) {
      return {
        ok: parsed.length,
        issues,
        warnings,
        columns: QUESTION_COLUMNS.map((c) => c.header),
        sample: raw
          .slice(0, 8)
          .map((r) => Object.fromEntries(QUESTION_COLUMNS.map((c) => [c.header, r[c.key] ?? ""]))),
      };
    }
    let position = target.quizId
      ? ((
          await this.prisma.quizQuestion.aggregate({
            where: { quizId: target.quizId },
            _max: { position: true },
          })
        )._max.position ?? -1) + 1
      : 0;
    for (const q of parsed) {
      const topic = q.topic
        ? topics.find((t) => t.title.toLowerCase() === q.topic.toLowerCase())
        : undefined;
      const created = await this.prisma.question.create({
        data: {
          type: q.type,
          text: q.text,
          difficulty: q.difficulty,
          subjectId: topic?.subjectId ?? subjectId,
          topicId: topic?.id ?? null,
          explanation: q.explanation,
          explanationVideoUrl: q.explanationVideoUrl,
          explanationImageUrl: q.explanationImageUrl,
          numericMin: q.numericMin,
          numericMax: q.numericMax,
          partialMarking: q.type === "MULTIPLE_CHOICE",
          status: "PUBLISHED",
          createdById: actor.id,
          options: {
            create: q.options.map((o, i) => ({
              text: o.text,
              isCorrect: o.isCorrect,
              position: i,
            })),
          },
        },
        select: { id: true },
      });
      if (target.quizId) {
        await this.prisma.quizQuestion.create({
          data: {
            quizId: target.quizId,
            questionId: created.id,
            marks: q.marks,
            position: position++,
          },
        });
      }
    }
    const failed = raw.filter((r) => issues.some((i) => i.row === Number(r.__row)));
    return {
      imported: parsed.length,
      skipped: failed.length,
      issues,
      requests: 0,
      errorFile: await this.excel.errorFile(
        "Questions",
        QUESTION_COLUMNS,
        failed.map((r) => ({
          values: r,
          message: issues
            .filter((i) => i.row === Number(r.__row))
            .map((i) => i.message)
            .join("; "),
        })),
      ),
    };
  }

  /** Every question of a quiz in the template's columns (download = same format as upload). */
  async exportQuizQuestions(actor: RequestUser, quizId: string) {
    await this.scope.assert(actor, "quiz", quizId);
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        title: true,
        quizQuestions: {
          orderBy: { position: "asc" },
          select: {
            marks: true,
            question: {
              select: {
                type: true,
                text: true,
                difficulty: true,
                explanation: true,
                explanationVideoUrl: true,
                explanationImageUrl: true,
                numericMin: true,
                numericMax: true,
                topic: { select: { title: true } },
                options: { orderBy: { position: "asc" }, select: { text: true, isCorrect: true } },
              },
            },
          },
        },
      },
    });
    if (!quiz) throw new NotFoundException("Quiz not found");
    const TYPE_LABEL: Record<string, string> = {
      SINGLE_CHOICE: "Single choice",
      MULTIPLE_CHOICE: "Multiple choice",
      TRUE_FALSE: "True or false",
      NUMERIC: "Numeric",
      UPLOAD: "Sketch upload",
    };
    const rows = quiz.quizQuestions.map(({ marks, question: q }) => {
      const letters = ["A", "B", "C", "D"];
      const isTf = q.type === "TRUE_FALSE";
      const correct = isTf
        ? (q.options.find((o) => o.isCorrect)?.text ?? "")
        : q.type === "NUMERIC"
          ? Number(q.numericMin) === Number(q.numericMax)
            ? String(q.numericMin ?? "")
            : `${q.numericMin}-${q.numericMax}`
          : q.options
              .map((o, i) => (o.isCorrect ? letters[i] : null))
              .filter(Boolean)
              .join(",");
      return {
        type: TYPE_LABEL[q.type] ?? q.type,
        text: q.text,
        a: isTf ? "" : (q.options[0]?.text ?? ""),
        b: isTf ? "" : (q.options[1]?.text ?? ""),
        c: isTf ? "" : (q.options[2]?.text ?? ""),
        d: isTf ? "" : (q.options[3]?.text ?? ""),
        correct,
        marks: Number(marks),
        difficulty: q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase(),
        topic: q.topic?.title ?? "",
        explanation: q.explanation ?? "",
        explanationVideoUrl: q.explanationVideoUrl ?? "",
        explanationImageUrl: q.explanationImageUrl ?? "",
      };
    });
    const buffer = await this.excel.build([
      { name: "Questions", columns: QUESTION_COLUMNS, rows, instructions: QUESTION_HELP },
    ]);
    return { buffer, fileName: `${quiz.title} questions.xlsx` };
  }

  // ------------------------------------------------------------ sketch marks Excel

  private readonly MARK_COLUMNS: SheetColumn[] = [
    { key: "answerId", header: "Answer id", hidden: true },
    { key: "email", header: "Student email", width: 28 },
    { key: "name", header: "Student", width: 22 },
    { key: "question", header: "Question", width: 50 },
    { key: "max", header: "Max marks", width: 10 },
    { key: "marks", header: "Marks", width: 9, required: true },
    { key: "comment", header: "Comment", width: 45 },
  ];

  /** Sketch answers of a quiz from my students; pending ones blank, marked ones filled. */
  async marksSheet(actor: RequestUser, quizId: string, blank: boolean) {
    await this.scope.assert(actor, "quiz", quizId);
    const s = await this.scope.scopeFor(actor);
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: { title: true },
    });
    if (!quiz) throw new NotFoundException("Quiz not found");
    const answers = await this.prisma.quizAttemptAnswer.findMany({
      where: {
        uploadAssetId: { not: null },
        attempt: {
          quizId,
          status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
          ...(s ? { userId: { in: s.studentIds } } : {}),
        },
      },
      orderBy: [{ attempt: { userId: "asc" } }, { question: { position: "asc" } }],
      select: {
        id: true,
        marksAwarded: true,
        sketchReview: { select: { expertComment: true, expertReviewedAt: true } },
        question: { select: { text: true } },
        attempt: { select: { user: { select: USER_NAME_SELECT } } },
      },
    });
    const rows = [];
    for (const a of answers) {
      const max = await this.sketches.maxMarks(a.id).catch(() => null);
      const reviewed = !!a.sketchReview?.expertReviewedAt;
      rows.push({
        answerId: a.id,
        email: a.attempt.user.email,
        name: personName(a.attempt.user),
        question: a.question.text,
        max: max ?? "",
        marks: blank || !reviewed ? "" : Number(a.marksAwarded ?? 0),
        comment: blank || !reviewed ? "" : (a.sketchReview?.expertComment ?? ""),
      });
    }
    const buffer = await this.excel.build([
      {
        name: "Marks",
        title: `${quiz.title} · sketch marks${blank ? " (template)" : ""}`,
        columns: this.MARK_COLUMNS,
        rows,
        instructions: [
          "One row per uploaded sketch. Fill Marks (0 to Max marks) and an optional Comment.",
          "Leave Marks blank to skip a row. Upload the file back from the quiz's Marks page.",
        ],
      },
    ]);
    return { buffer, fileName: `${quiz.title} marks${blank ? " template" : ""}.xlsx` };
  }

  async importMarks(
    actor: RequestUser,
    quizId: string,
    contentBase64: string,
    dryRun: boolean,
  ): Promise<ImportPreview | ImportResult> {
    await this.scope.assert(actor, "quiz", quizId);
    const s = await this.scope.scopeFor(actor);
    const raw = await this.excel.read(contentBase64, this.MARK_COLUMNS);
    const issues: { row: number; message: string }[] = [];
    const ok: { answerId: string; marks: number; comment: string | null }[] = [];
    for (const r of raw) {
      const row = Number(r.__row);
      if (!r.marks) continue;
      const marks = Number(r.marks);
      const answer = r.answerId
        ? await this.prisma.quizAttemptAnswer.findFirst({
            where: {
              id: r.answerId,
              attempt: { quizId, ...(s ? { userId: { in: s.studentIds } } : {}) },
            },
            select: { id: true },
          })
        : null;
      if (!answer) {
        issues.push({
          row,
          message: "This row isn't a sketch from this quiz (keep the hidden Answer id column)",
        });
        continue;
      }
      const max = await this.sketches.maxMarks(answer.id).catch(() => null);
      if (!Number.isFinite(marks) || marks < 0 || (max !== null && marks > max)) {
        issues.push({ row, message: `Marks must be between 0 and ${max ?? "the maximum"}` });
        continue;
      }
      ok.push({ answerId: answer.id, marks, comment: r.comment?.trim() || null });
    }
    if (dryRun) {
      return {
        ok: ok.length,
        issues,
        warnings: [],
        columns: this.MARK_COLUMNS.filter((c) => !c.hidden).map((c) => c.header),
        sample: raw
          .slice(0, 8)
          .map((r) =>
            Object.fromEntries(
              this.MARK_COLUMNS.filter((c) => !c.hidden).map((c) => [c.header, r[c.key] ?? ""]),
            ),
          ),
      };
    }
    for (const m of ok) {
      await this.sketches.review(actor.id, m.answerId, {
        scores: {},
        marks: m.marks,
        comment: m.comment ?? undefined,
      });
    }
    const failed = raw.filter((r) => issues.some((i) => i.row === Number(r.__row)));
    return {
      imported: ok.length,
      skipped: failed.length,
      issues,
      requests: 0,
      errorFile: await this.excel.errorFile(
        "Marks",
        this.MARK_COLUMNS,
        failed.map((r) => ({
          values: r,
          message: issues
            .filter((i) => i.row === Number(r.__row))
            .map((i) => i.message)
            .join("; "),
        })),
      ),
    };
  }
}
