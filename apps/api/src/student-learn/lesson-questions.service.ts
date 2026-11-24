import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@examora/database";
import type {
  AdminLessonQuestion,
  AnswerMethod,
  LessonPracticeAnswer,
  LessonPracticeQuestion,
  LessonQuestionType,
} from "@examora/types";
import { toExplanationSteps, toResources } from "../assessment/assessment.mappers";
import { PrismaService } from "../prisma/prisma.service";

const ANSWERABLE: LessonQuestionType[] = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "NUMERIC",
];

const QUESTION_SELECT = {
  id: true,
  type: true,
  text: true,
  imageUrl: true,
  explanation: true,
  explanationImageUrl: true,
  explanationSteps: true,
  explanationVideoUrl: true,
  resources: true,
  numericMin: true,
  numericMax: true,
  options: {
    orderBy: { position: "asc" },
    select: { id: true, text: true, imageUrl: true, isCorrect: true },
  },
} satisfies Prisma.QuestionSelect;

type LoadedQuestion = Prisma.QuestionGetPayload<{ select: typeof QUESTION_SELECT }>;

interface StoredAnswer {
  selectedOptionIds: string[];
  numericValue: Prisma.Decimal | null;
  method: AnswerMethod | null;
  correct: boolean;
}

/** Whether a lesson answer is right: exact option set, or a number inside the range. */
export function isLessonAnswerCorrect(
  question: Pick<LoadedQuestion, "type" | "numericMin" | "numericMax" | "options">,
  optionIds: string[],
  numericValue: number | null,
): boolean {
  if (question.type === "NUMERIC") {
    if (numericValue === null || question.numericMin === null || question.numericMax === null) {
      return false;
    }
    return (
      numericValue >= Number(question.numericMin) && numericValue <= Number(question.numericMax)
    );
  }
  const correct = question.options.filter((o) => o.isCorrect).map((o) => o.id);
  const picked = new Set(optionIds);
  return picked.size === correct.length && correct.every((id) => picked.has(id));
}

/**
 * Practice questions inside a lesson (past-paper examples). Students answer
 * each once and then see the answer and explanation; nothing feeds a quiz score.
 */
@Injectable()
export class LessonQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(
    linkId: string,
    q: LoadedQuestion,
    answer: StoredAnswer | null,
  ): LessonPracticeQuestion {
    let revealed: LessonPracticeAnswer | null = null;
    if (answer) {
      revealed = {
        selectedOptionIds: answer.selectedOptionIds,
        numericValue: answer.numericValue === null ? null : Number(answer.numericValue),
        method: answer.method,
        correct: answer.correct,
        correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
        numericRange:
          q.type === "NUMERIC" && q.numericMin !== null && q.numericMax !== null
            ? { min: Number(q.numericMin), max: Number(q.numericMax) }
            : null,
        explanation: q.explanation,
        explanationImageUrl: q.explanationImageUrl,
        explanationSteps: toExplanationSteps(q.explanationSteps),
        explanationVideoUrl: q.explanationVideoUrl,
        resources: toResources(q.resources),
      };
    }
    return {
      id: linkId,
      questionId: q.id,
      type: q.type as LessonQuestionType,
      text: q.text,
      imageUrl: q.imageUrl,
      options: q.options.map((o) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl })),
      answer: revealed,
    };
  }

  /** The lesson's questions for a student, with their earlier answers revealed. */
  async forStudent(userId: string, lessonId: string): Promise<LessonPracticeQuestion[]> {
    const links = await this.prisma.lessonQuestion.findMany({
      where: {
        lessonId,
        question: { deletedAt: null, type: { in: ANSWERABLE } },
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        question: { select: QUESTION_SELECT },
        answers: {
          where: { userId },
          select: { selectedOptionIds: true, numericValue: true, method: true, correct: true },
        },
      },
    });
    return links.map((l) => this.toView(l.id, l.question, l.answers[0] ?? null));
  }

  async answer(
    userId: string,
    lessonId: string,
    linkId: string,
    input: { optionIds?: string[]; numericValue?: number | null; method?: AnswerMethod | null },
  ): Promise<LessonPracticeQuestion> {
    const link = await this.prisma.lessonQuestion.findFirst({
      where: { id: linkId, lessonId, question: { deletedAt: null, type: { in: ANSWERABLE } } },
      select: { id: true, question: { select: QUESTION_SELECT } },
    });
    if (!link) throw new NotFoundException("Question not found in this lesson");
    const q = link.question;

    let optionIds: string[] = [];
    let numericValue: number | null = null;
    if (q.type === "NUMERIC") {
      if (input.numericValue === undefined || input.numericValue === null) {
        throw new BadRequestException("Enter a number");
      }
      numericValue = input.numericValue;
    } else {
      optionIds = [...new Set(input.optionIds ?? [])];
      if (optionIds.length === 0) throw new BadRequestException("Choose an option");
      const valid = new Set(q.options.map((o) => o.id));
      if (optionIds.some((id) => !valid.has(id))) {
        throw new BadRequestException("That option is not part of this question");
      }
      if (q.type !== "MULTIPLE_CHOICE" && optionIds.length > 1) {
        throw new BadRequestException("Choose one option");
      }
    }

    const correct = isLessonAnswerCorrect(q, optionIds, numericValue);
    try {
      const saved = await this.prisma.lessonQuestionAnswer.create({
        data: {
          userId,
          lessonQuestionId: link.id,
          selectedOptionIds: optionIds,
          numericValue,
          method: input.method ?? null,
          correct,
        },
        select: { selectedOptionIds: true, numericValue: true, method: true, correct: true },
      });
      return this.toView(link.id, q, saved);
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        throw new ConflictException("You have already answered this question");
      }
      throw err;
    }
  }

  // ------------------------------------------------------------------ admin

  private async assertLesson(lessonId: string): Promise<void> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
      select: { id: true },
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
  }

  async adminList(lessonId: string): Promise<AdminLessonQuestion[]> {
    await this.assertLesson(lessonId);
    const links = await this.prisma.lessonQuestion.findMany({
      where: { lessonId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        position: true,
        question: { select: { id: true, text: true, type: true } },
      },
    });
    return links.map((l) => ({
      id: l.id,
      questionId: l.question.id,
      text: l.question.text,
      type: l.question.type,
      position: l.position,
    }));
  }

  async adminAttach(lessonId: string, questionId: string): Promise<AdminLessonQuestion[]> {
    await this.assertLesson(lessonId);
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, deletedAt: null },
      select: { type: true },
    });
    if (!question) throw new NotFoundException("Question not found");
    if (!ANSWERABLE.includes(question.type as LessonQuestionType)) {
      throw new BadRequestException("Sketch (upload) questions can't be used inside a lesson");
    }
    const last = await this.prisma.lessonQuestion.aggregate({
      where: { lessonId },
      _max: { position: true },
    });
    try {
      await this.prisma.lessonQuestion.create({
        data: { lessonId, questionId, position: (last._max.position ?? -1) + 1 },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        throw new ConflictException("That question is already in this lesson");
      }
      throw err;
    }
    return this.adminList(lessonId);
  }

  async adminDetach(lessonId: string, linkId: string): Promise<void> {
    const { count } = await this.prisma.lessonQuestion.deleteMany({
      where: { id: linkId, lessonId },
    });
    if (count === 0) throw new NotFoundException("Question not found in this lesson");
  }
}
