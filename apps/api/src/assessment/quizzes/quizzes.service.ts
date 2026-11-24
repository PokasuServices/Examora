import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ContentStatus } from "@examora/types";
import type { Prisma } from "@examora/database";
import { slugify } from "@examora/utils";
import { assertValidStatusTransition } from "../../content/content-status.util";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateQuizDto } from "./dto/create-quiz.dto";
import type { UpdateQuizDto } from "./dto/update-quiz.dto";

const QUESTION_PREVIEW = {
  question: { select: { text: true, type: true, difficulty: true } },
} satisfies Prisma.QuizQuestionInclude;

@Injectable()
export class QuizzesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateQuizDto, actorId: string) {
    if (dto.subjectId) {
      await this.assertSubjectExists(dto.subjectId);
    }
    if (dto.topicId) {
      await this.assertTopicInSubject(dto.topicId, dto.subjectId ?? null);
    }
    const slug = await this.resolveUniqueSlug(dto.slug ?? slugify(dto.title));
    const position = dto.position ?? (await this.nextPosition());

    return this.prisma.quiz.create({
      data: {
        subjectId: dto.subjectId,
        title: dto.title,
        slug,
        description: dto.description,
        timeLimitMinutes: dto.timeLimitMinutes,
        passingScorePercent: dto.passingScorePercent ?? 40,
        negativeMarkingEnabled: dto.negativeMarkingEnabled ?? false,
        negativeMarksPerWrong: dto.negativeMarksPerWrong ?? 0,
        shuffleQuestions: dto.shuffleQuestions ?? false,
        shuffleOptions: dto.shuffleOptions ?? false,
        topicId: dto.topicId ?? null,
        maxAttempts: dto.maxAttempts ?? null,
        xpReward: dto.xpReward ?? 0,
        level: dto.level ?? null,
        practiceCategoryId: dto.practiceCategoryId ?? null,
        unlockAfterQuizId: dto.unlockAfterQuizId ?? null,
        requireAllVisited: dto.requireAllVisited ?? false,
        position,
        createdById: actorId,
      },
    });
  }

  async list(params: {
    page: number;
    pageSize: number;
    status?: ContentStatus;
    subjectId?: string;
  }) {
    const where: Prisma.QuizWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.subjectId ? { subjectId: params.subjectId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.quiz.findMany({
        where,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.quiz.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const quiz = await this.prisma.quiz.findFirst({ where: { id, deletedAt: null } });
    if (!quiz) {
      throw new NotFoundException("Quiz not found");
    }
    return quiz;
  }

  /** Full authoring view: quiz + sections + assigned questions (with a preview), ordered. */
  async findDetailOrThrow(id: string) {
    const quiz = await this.findByIdOrThrow(id);
    const [sections, quizQuestions] = await Promise.all([
      this.prisma.quizSection.findMany({ where: { quizId: id }, orderBy: { position: "asc" } }),
      this.prisma.quizQuestion.findMany({
        where: { quizId: id },
        include: QUESTION_PREVIEW,
        orderBy: [{ position: "asc" }],
      }),
    ]);
    return { quiz, sections, quizQuestions };
  }

  async update(id: string, dto: UpdateQuizDto) {
    const existing = await this.findByIdOrThrow(id);
    if (dto.subjectId) {
      await this.assertSubjectExists(dto.subjectId);
    }
    if (dto.topicId) {
      await this.assertTopicInSubject(dto.topicId, dto.subjectId ?? existing.subjectId);
    }
    if (dto.unlockAfterQuizId === id) {
      throw new BadRequestException("A quiz can't unlock itself");
    }
    if (dto.practiceCategoryId) {
      await this.assertCategoryExists(dto.practiceCategoryId);
    }
    const slug =
      dto.slug !== undefined || dto.title !== undefined
        ? await this.resolveUniqueSlug(dto.slug ?? slugify(dto.title ?? existing.title), id)
        : undefined;

    return this.prisma.quiz.update({
      where: { id },
      data: {
        subjectId: dto.subjectId,
        title: dto.title,
        slug,
        description: dto.description,
        timeLimitMinutes: dto.timeLimitMinutes,
        passingScorePercent: dto.passingScorePercent,
        negativeMarkingEnabled: dto.negativeMarkingEnabled,
        negativeMarksPerWrong: dto.negativeMarksPerWrong,
        shuffleQuestions: dto.shuffleQuestions,
        shuffleOptions: dto.shuffleOptions,
        topicId: dto.topicId,
        maxAttempts: dto.maxAttempts,
        xpReward: dto.xpReward,
        level: dto.level,
        practiceCategoryId: dto.practiceCategoryId,
        unlockAfterQuizId: dto.unlockAfterQuizId,
        requireAllVisited: dto.requireAllVisited,
        position: dto.position,
      },
    });
  }

  /**
   * Publishing requires at least one assigned question, and every assigned
   * question must itself be PUBLISHED — an authoring-time integrity gate so a
   * live quiz never surfaces an unreviewed draft question to students.
   */
  async changeStatus(id: string, status: ContentStatus) {
    const existing = await this.findByIdOrThrow(id);
    assertValidStatusTransition(existing.status, status);

    if (status === "PUBLISHED") {
      const assigned = await this.prisma.quizQuestion.findMany({
        where: { quizId: id },
        include: { question: { select: { status: true } } },
      });
      if (assigned.length === 0) {
        throw new BadRequestException("Assign at least one question before publishing");
      }
      const unpublished = assigned.filter((a) => a.question.status !== "PUBLISHED");
      if (unpublished.length > 0) {
        throw new BadRequestException(
          `${unpublished.length} assigned question(s) are not PUBLISHED — publish them first`,
        );
      }
    }

    return this.prisma.quiz.update({
      where: { id },
      data: {
        status,
        publishedAt:
          status === "PUBLISHED" && !existing.publishedAt ? new Date() : existing.publishedAt,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.findByIdOrThrow(id);
    if (existing.status === "PUBLISHED") {
      throw new BadRequestException("Archive the quiz before deleting it");
    }
    await this.prisma.quiz.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async assertCategoryExists(id: string): Promise<void> {
    const found = await this.prisma.practiceCategory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new BadRequestException("practiceCategoryId does not reference a category");
  }

  /** A topic quiz's topic must belong to the quiz's subject (so the Learn page and access checks agree). */
  private async assertTopicInSubject(topicId: string, subjectId: string | null): Promise<void> {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, deletedAt: null },
      select: { subjectId: true },
    });
    if (!topic) {
      throw new BadRequestException("topicId does not reference an existing topic");
    }
    if (topic.subjectId !== subjectId) {
      throw new BadRequestException("The topic must belong to the quiz's subject");
    }
  }

  private async assertSubjectExists(subjectId: string): Promise<void> {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, deletedAt: null },
      select: { id: true },
    });
    if (!subject) {
      throw new BadRequestException("subjectId does not reference an existing subject");
    }
  }

  private async nextPosition(): Promise<number> {
    const last = await this.prisma.quiz.findFirst({
      where: { deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async resolveUniqueSlug(base: string, excludeId?: string): Promise<string> {
    const clash = await this.prisma.quiz.findFirst({
      where: { slug: base, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(`A quiz with slug "${base}" already exists`);
    }
    return base;
  }
}
