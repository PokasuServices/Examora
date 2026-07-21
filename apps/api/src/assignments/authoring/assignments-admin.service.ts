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
import { decToNum } from "../assignments.mappers";
import type { CreateAssignmentDto } from "./dto/create-assignment.dto";
import type { CreateCriterionDto } from "./dto/create-criterion.dto";
import type { UpdateAssignmentDto } from "./dto/update-assignment.dto";
import type { UpdateCriterionDto } from "./dto/update-criterion.dto";

const WITH_CRITERIA = { criteria: { orderBy: { position: "asc" as const } } };

@Injectable()
export class AssignmentsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAssignmentDto, actorId: string) {
    let brief = dto.brief;
    let fileRules = dto.fileRules;
    let marksTotal = dto.marksTotal;
    let rubricSkeleton: { title: string; description?: string; maxMarks: number }[] = [];

    if (dto.templateId) {
      const template = await this.prisma.assignmentTemplate.findFirst({
        where: { id: dto.templateId, deletedAt: null },
      });
      if (!template) {
        throw new BadRequestException("templateId does not reference an existing template");
      }
      brief = brief ?? template.brief;
      fileRules = fileRules ?? (template.fileRules as unknown as CreateAssignmentDto["fileRules"]);
      marksTotal = marksTotal ?? decToNum(template.marksTotal);
      rubricSkeleton = template.rubric as unknown as typeof rubricSkeleton;
    }

    if (!brief || !fileRules || marksTotal === undefined) {
      throw new BadRequestException(
        "brief, fileRules and marksTotal are required unless templateId is supplied",
      );
    }
    if (dto.subjectId) {
      await this.assertSubjectExists(dto.subjectId);
    }

    const slug = await this.resolveUniqueSlug(dto.slug ?? slugify(dto.title));
    const position = dto.position ?? (await this.nextPosition());

    return this.prisma.assignment.create({
      data: {
        subjectId: dto.subjectId,
        title: dto.title,
        slug,
        brief,
        fileRules: fileRules as unknown as Prisma.InputJsonValue,
        marksTotal,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        position,
        createdById: actorId,
        criteria:
          rubricSkeleton.length > 0
            ? {
                create: rubricSkeleton.map((c, i) => ({
                  title: c.title,
                  description: c.description,
                  maxMarks: c.maxMarks,
                  position: i,
                })),
              }
            : undefined,
      },
      include: WITH_CRITERIA,
    });
  }

  async list(params: {
    page: number;
    pageSize: number;
    status?: ContentStatus;
    subjectId?: string;
  }) {
    const where: Prisma.AssignmentWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.subjectId ? { subjectId: params.subjectId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.assignment.findMany({
        where,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.assignment.count({ where }),
    ]);
    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const assignment = await this.prisma.assignment.findFirst({ where: { id, deletedAt: null } });
    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }
    return assignment;
  }

  async findDetailOrThrow(id: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, deletedAt: null },
      include: WITH_CRITERIA,
    });
    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }
    return assignment;
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    const existing = await this.findByIdOrThrow(id);
    if (dto.subjectId) {
      await this.assertSubjectExists(dto.subjectId);
    }
    const slug =
      dto.slug !== undefined || dto.title !== undefined
        ? await this.resolveUniqueSlug(dto.slug ?? slugify(dto.title ?? existing.title), id)
        : undefined;

    return this.prisma.assignment.update({
      where: { id },
      data: {
        subjectId: dto.subjectId,
        title: dto.title,
        slug,
        brief: dto.brief,
        fileRules: dto.fileRules as unknown as Prisma.InputJsonValue | undefined,
        marksTotal: dto.marksTotal,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        position: dto.position,
      },
      include: WITH_CRITERIA,
    });
  }

  /** Publishing requires at least one rubric criterion (ADR-0015). */
  async changeStatus(id: string, status: ContentStatus) {
    const existing = await this.findByIdOrThrow(id);
    assertValidStatusTransition(existing.status, status);

    if (status === "PUBLISHED") {
      const criteriaCount = await this.prisma.rubricCriterion.count({
        where: { assignmentId: id },
      });
      if (criteriaCount === 0) {
        throw new BadRequestException("Add at least one rubric criterion before publishing");
      }
    }

    return this.prisma.assignment.update({
      where: { id },
      data: {
        status,
        publishedAt:
          status === "PUBLISHED" && !existing.publishedAt ? new Date() : existing.publishedAt,
      },
    });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findByIdOrThrow(id);
    if (existing.status === "PUBLISHED") {
      throw new BadRequestException("Archive the assignment before deleting it");
    }
    await this.prisma.assignment.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // -- Rubric criteria ------------------------------------------------------

  async addCriterion(assignmentId: string, dto: CreateCriterionDto) {
    await this.findByIdOrThrow(assignmentId);
    const position = dto.position ?? (await this.nextCriterionPosition(assignmentId));
    return this.prisma.rubricCriterion.create({
      data: {
        assignmentId,
        title: dto.title,
        description: dto.description,
        maxMarks: dto.maxMarks,
        position,
      },
    });
  }

  async updateCriterion(assignmentId: string, id: string, dto: UpdateCriterionDto) {
    await this.findCriterionOrThrow(assignmentId, id);
    return this.prisma.rubricCriterion.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        maxMarks: dto.maxMarks,
        position: dto.position,
      },
    });
  }

  async removeCriterion(assignmentId: string, id: string): Promise<void> {
    await this.findCriterionOrThrow(assignmentId, id);
    await this.prisma.rubricCriterion.delete({ where: { id } });
  }

  private async findCriterionOrThrow(assignmentId: string, id: string) {
    const criterion = await this.prisma.rubricCriterion.findFirst({ where: { id, assignmentId } });
    if (!criterion) {
      throw new NotFoundException("Rubric criterion not found");
    }
    return criterion;
  }

  private async nextCriterionPosition(assignmentId: string): Promise<number> {
    const last = await this.prisma.rubricCriterion.findFirst({
      where: { assignmentId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
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
    const last = await this.prisma.assignment.findFirst({
      where: { deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async resolveUniqueSlug(base: string, excludeId?: string): Promise<string> {
    const clash = await this.prisma.assignment.findFirst({
      where: { slug: base, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(`An assignment with slug "${base}" already exists`);
    }
    return base;
  }
}
