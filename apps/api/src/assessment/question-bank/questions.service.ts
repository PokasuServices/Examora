import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { ContentStatus, DifficultyLevel, QuestionType } from "@examora/types";
import type { Prisma } from "@examora/database";
import { assertValidStatusTransition } from "../../content/content-status.util";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateQuestionDto } from "./dto/create-question.dto";
import type { QuestionOptionInputDto } from "./dto/question-option-input.dto";
import type { UpdateQuestionDto } from "./dto/update-question.dto";

/** Stored media references: an https URL or "media:<assetId>" (see resolveMediaUrl in @examora/types). */
const MEDIA_REF = /^media:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertMediaRef(field: string, value: string | null | undefined): void {
  if (value === null || value === undefined || value === "") return;
  if (!MEDIA_REF.test(value) && !/^https:\/\/\S+$/i.test(value)) {
    throw new BadRequestException(`${field} must be an https URL or an uploaded media reference`);
  }
}

/** Steps keep their order; captions are trimmed and empty ones dropped. */
function cleanSteps(steps: { imageUrl: string; caption?: string | null }[]) {
  return steps.map((s) => ({ imageUrl: s.imageUrl, caption: s.caption?.trim() || null }));
}

/** Empty strings clear a media field, like null. */
const mediaOrNull = (v: string | null | undefined) => (v === undefined ? undefined : v || null);

interface QuestionShape {
  type: QuestionType;
  criteria?: string[];
  options: { text: string; isCorrect: boolean; imageUrl?: string | null }[];
  numericMin: number | null;
  numericMax: number | null;
}

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateQuestionDto, actorId: string) {
    this.assertValidQuestion(this.shapeOf(dto));
    this.assertMedia(dto);
    if (dto.subjectId) {
      await this.assertSubjectExists(dto.subjectId);
    }
    const position = await this.nextPosition();

    return this.prisma.question.create({
      data: {
        subjectId: dto.subjectId,
        type: dto.type,
        difficulty: dto.difficulty ?? "MEDIUM",
        text: dto.text,
        explanation: dto.explanation,
        ...this.extraFieldsForCreate(dto),
        tags: dto.tags ?? [],
        position,
        createdById: actorId,
        options: {
          create: (dto.options ?? []).map((o, index) => ({
            text: o.text,
            imageUrl: o.imageUrl || null,
            isCorrect: o.isCorrect,
            position: index,
          })),
        },
      },
      include: { options: { orderBy: { position: "asc" } } },
    });
  }

  /** Bulk-import foundation (Sprint 4): validates and inserts an array in one transaction. */
  async bulkCreate(dtos: CreateQuestionDto[], actorId: string) {
    dtos.forEach((dto) => {
      this.assertValidQuestion(this.shapeOf(dto));
      this.assertMedia(dto);
    });

    const subjectIds = [
      ...new Set(dtos.map((d) => d.subjectId).filter((id): id is string => !!id)),
    ];
    if (subjectIds.length > 0) {
      const found = await this.prisma.subject.findMany({
        where: { id: { in: subjectIds }, deletedAt: null },
        select: { id: true },
      });
      if (found.length !== subjectIds.length) {
        throw new BadRequestException(
          "One or more subjectIds do not reference an existing subject",
        );
      }
    }

    const startPosition = await this.nextPosition();
    return this.prisma.$transaction(
      dtos.map((dto, index) =>
        this.prisma.question.create({
          data: {
            subjectId: dto.subjectId,
            type: dto.type,
            difficulty: dto.difficulty ?? "MEDIUM",
            text: dto.text,
            explanation: dto.explanation,
            ...this.extraFieldsForCreate(dto),
            tags: dto.tags ?? [],
            position: startPosition + index,
            createdById: actorId,
            options: {
              create: (dto.options ?? []).map((o, i) => ({
                text: o.text,
                imageUrl: o.imageUrl || null,
                isCorrect: o.isCorrect,
                position: i,
              })),
            },
          },
        }),
      ),
    );
  }

  async list(params: {
    page: number;
    pageSize: number;
    status?: ContentStatus;
    subjectId?: string;
    type?: QuestionType;
    difficulty?: DifficultyLevel;
    tag?: string;
    search?: string;
  }) {
    const search = params.search?.trim();
    const where: Prisma.QuestionWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.subjectId ? { subjectId: params.subjectId } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.difficulty ? { difficulty: params.difficulty } : {}),
      ...(params.tag ? { tags: { has: params.tag } } : {}),
      ...(search ? { text: { contains: search, mode: "insensitive" } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        include: { options: { orderBy: { position: "asc" } } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.question.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const question = await this.prisma.question.findFirst({
      where: { id, deletedAt: null },
      include: { options: { orderBy: { position: "asc" } } },
    });
    if (!question) {
      throw new NotFoundException("Question not found");
    }
    return question;
  }

  /**
   * Updates in place. When `options` is supplied, existing option rows are
   * updated by position index (preserving their id) rather than deleted and
   * recreated — an attempt that already froze an optionOrder snapshot
   * (ADR-0014) referencing these ids keeps resolving them after a plain edit.
   * Only a change in option *count* creates/removes rows.
   */
  async update(id: string, dto: UpdateQuestionDto) {
    const existing = await this.findByIdOrThrow(id);
    const type = dto.type ?? existing.type;
    const keep = (incoming: number | null | undefined, stored: Prisma.Decimal | null) =>
      type !== "NUMERIC"
        ? null
        : incoming !== undefined
          ? incoming
          : stored === null
            ? null
            : Number(stored);
    const numericMin = keep(dto.numericMin, existing.numericMin);
    const numericMax = keep(dto.numericMax, existing.numericMax);
    const storedCriteria = Array.isArray(existing.criteria) ? (existing.criteria as string[]) : [];
    this.assertValidQuestion({
      type,
      options: dto.options ?? existing.options,
      numericMin,
      numericMax,
      criteria: dto.criteria ?? storedCriteria,
    });
    this.assertMedia(dto);
    if (dto.subjectId) {
      await this.assertSubjectExists(dto.subjectId);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id },
        data: {
          subjectId: dto.subjectId,
          type: dto.type,
          difficulty: dto.difficulty,
          text: dto.text,
          explanation: dto.explanation,
          imageUrl: mediaOrNull(dto.imageUrl),
          numericMin,
          numericMax,
          // Partial marking only means something for multi-select questions.
          partialMarking: type === "MULTIPLE_CHOICE" ? dto.partialMarking : false,
          explanationImageUrl: mediaOrNull(dto.explanationImageUrl),
          explanationVideoUrl: mediaOrNull(dto.explanationVideoUrl),
          explanationSteps:
            dto.explanationSteps === undefined
              ? undefined
              : (cleanSteps(dto.explanationSteps) as unknown as Prisma.InputJsonValue),
          resources:
            dto.resources === undefined
              ? undefined
              : (dto.resources as unknown as Prisma.InputJsonValue),
          topicId: dto.topicId,
          criteria:
            dto.criteria === undefined
              ? undefined
              : (dto.criteria
                  .map((c) => c.trim())
                  .filter(Boolean) as unknown as Prisma.InputJsonValue),
          tags: dto.tags,
        },
      });

      if (dto.options) {
        await this.replaceOptionsPreservingIds(tx, id, existing.options, dto.options);
      }

      return tx.question.findFirstOrThrow({
        where: { id },
        include: { options: { orderBy: { position: "asc" } } },
      });
    });
  }

  async changeStatus(id: string, status: ContentStatus) {
    const existing = await this.findByIdOrThrow(id);
    assertValidStatusTransition(existing.status, status);

    if (status !== "PUBLISHED") {
      const liveAssignment = await this.prisma.quizQuestion.findFirst({
        where: { questionId: id, quiz: { status: "PUBLISHED" } },
        select: { id: true },
      });
      if (liveAssignment) {
        throw new BadRequestException(
          "This question is assigned to a published quiz — unassign it before changing status",
        );
      }
    }

    return this.prisma.question.update({
      where: { id },
      data: { status },
      include: { options: { orderBy: { position: "asc" } } },
    });
  }

  async remove(id: string) {
    await this.findByIdOrThrow(id);
    const assignmentCount = await this.prisma.quizQuestion.count({ where: { questionId: id } });
    if (assignmentCount > 0) {
      throw new BadRequestException("Unassign this question from all quizzes before deleting it");
    }
    await this.prisma.question.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async replaceOptionsPreservingIds(
    tx: Prisma.TransactionClient,
    questionId: string,
    existingOptions: { id: string }[],
    incoming: QuestionOptionInputDto[],
  ): Promise<void> {
    for (const [index, option] of incoming.entries()) {
      const match = existingOptions[index];
      if (match) {
        await tx.questionOption.update({
          where: { id: match.id },
          data: {
            text: option.text,
            imageUrl: option.imageUrl || null,
            isCorrect: option.isCorrect,
            position: index,
          },
        });
      } else {
        await tx.questionOption.create({
          data: {
            questionId,
            text: option.text,
            imageUrl: option.imageUrl || null,
            isCorrect: option.isCorrect,
            position: index,
          },
        });
      }
    }
    if (existingOptions.length > incoming.length) {
      const removeIds = existingOptions.slice(incoming.length).map((o) => o.id);
      await tx.questionOption.deleteMany({ where: { id: { in: removeIds } } });
    }
  }

  private shapeOf(dto: CreateQuestionDto): QuestionShape {
    return {
      type: dto.type,
      options: dto.options ?? [],
      numericMin: dto.numericMin ?? null,
      numericMax: dto.numericMax ?? null,
      criteria: dto.criteria,
    };
  }

  /** Fields added by the question engine, as stored on create. */
  private extraFieldsForCreate(dto: CreateQuestionDto) {
    const numeric = dto.type === "NUMERIC";
    return {
      imageUrl: dto.imageUrl || null,
      numericMin: numeric ? (dto.numericMin ?? null) : null,
      numericMax: numeric ? (dto.numericMax ?? null) : null,
      partialMarking: dto.type === "MULTIPLE_CHOICE" ? (dto.partialMarking ?? false) : false,
      explanationImageUrl: dto.explanationImageUrl || null,
      explanationVideoUrl: dto.explanationVideoUrl || null,
      explanationSteps: cleanSteps(dto.explanationSteps ?? []) as unknown as Prisma.InputJsonValue,
      resources: (dto.resources ?? []) as unknown as Prisma.InputJsonValue,
      topicId: dto.topicId ?? null,
      criteria: (dto.type === "UPLOAD"
        ? (dto.criteria ?? []).map((c) => c.trim()).filter(Boolean)
        : []) as unknown as Prisma.InputJsonValue,
    };
  }

  private assertMedia(dto: Partial<CreateQuestionDto>): void {
    assertMediaRef("imageUrl", dto.imageUrl);
    assertMediaRef("explanationImageUrl", dto.explanationImageUrl);
    assertMediaRef("explanationVideoUrl", dto.explanationVideoUrl);
    dto.explanationSteps?.forEach((s, i) =>
      assertMediaRef(`explanationSteps[${i}].imageUrl`, s.imageUrl || "-"),
    );
    dto.options?.forEach((o, i) => assertMediaRef(`options[${i}].imageUrl`, o.imageUrl));
  }

  private assertValidQuestion(q: QuestionShape): void {
    if (q.type === "UPLOAD") {
      if (q.options.length > 0) {
        throw new BadRequestException("UPLOAD questions have no options; send an empty list");
      }
      if (!q.criteria || q.criteria.filter((c) => c.trim()).length === 0) {
        throw new BadRequestException("UPLOAD questions need at least one rating criterion");
      }
      return;
    }
    if (q.type === "NUMERIC") {
      if (q.options.length > 0) {
        throw new BadRequestException("NUMERIC questions have no options; send an empty list");
      }
      if (q.numericMin === null || q.numericMax === null) {
        throw new BadRequestException("NUMERIC questions need numericMin and numericMax");
      }
      if (q.numericMin > q.numericMax) {
        throw new BadRequestException("numericMin must not be greater than numericMax");
      }
      return;
    }
    if (q.options.length < 2) {
      throw new BadRequestException("Questions need at least 2 options");
    }
    if (q.options.some((o) => !o.text.trim() && !o.imageUrl)) {
      throw new BadRequestException("Every option needs text or an image");
    }
    this.assertValidOptions(q.type, q.options);
  }

  private assertValidOptions(type: QuestionType, options: { isCorrect: boolean }[]): void {
    const correctCount = options.filter((o) => o.isCorrect).length;
    if (correctCount === 0) {
      throw new BadRequestException("At least one option must be marked correct");
    }
    if (type === "TRUE_FALSE" && options.length !== 2) {
      throw new BadRequestException("TRUE_FALSE questions must have exactly 2 options");
    }
    if ((type === "SINGLE_CHOICE" || type === "TRUE_FALSE") && correctCount !== 1) {
      throw new BadRequestException(`${type} questions must have exactly 1 correct option`);
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
    const last = await this.prisma.question.findFirst({
      where: { deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }
}
