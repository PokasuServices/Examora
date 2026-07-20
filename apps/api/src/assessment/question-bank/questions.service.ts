import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { ContentStatus, DifficultyLevel, QuestionType } from "@examora/types";
import type { Prisma } from "@examora/database";
import { assertValidStatusTransition } from "../../content/content-status.util";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateQuestionDto } from "./dto/create-question.dto";
import type { QuestionOptionInputDto } from "./dto/question-option-input.dto";
import type { UpdateQuestionDto } from "./dto/update-question.dto";

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateQuestionDto, actorId: string) {
    this.assertValidOptions(dto.type, dto.options);
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
        tags: dto.tags ?? [],
        position,
        createdById: actorId,
        options: {
          create: dto.options.map((o, index) => ({
            text: o.text,
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
    dtos.forEach((dto) => this.assertValidOptions(dto.type, dto.options));

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
            tags: dto.tags ?? [],
            position: startPosition + index,
            createdById: actorId,
            options: {
              create: dto.options.map((o, i) => ({
                text: o.text,
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
  }) {
    const where: Prisma.QuestionWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.subjectId ? { subjectId: params.subjectId } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.difficulty ? { difficulty: params.difficulty } : {}),
      ...(params.tag ? { tags: { has: params.tag } } : {}),
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
    if (dto.options) {
      this.assertValidOptions(type, dto.options);
    } else if (dto.type && dto.type !== existing.type) {
      this.assertValidOptions(type, existing.options);
    }
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
          data: { text: option.text, isCorrect: option.isCorrect, position: index },
        });
      } else {
        await tx.questionOption.create({
          data: { questionId, text: option.text, isCorrect: option.isCorrect, position: index },
        });
      }
    }
    if (existingOptions.length > incoming.length) {
      const removeIds = existingOptions.slice(incoming.length).map((o) => o.id);
      await tx.questionOption.deleteMany({ where: { id: { in: removeIds } } });
    }
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
