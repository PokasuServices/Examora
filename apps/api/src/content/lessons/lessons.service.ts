import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ContentStatus } from "@examora/types";
import type { Prisma } from "@examora/database";
import { slugify } from "@examora/utils";
import { PrismaService } from "../../prisma/prisma.service";
import { assertValidStatusTransition } from "../content-status.util";
import type { CreateLessonDto } from "./dto/create-lesson.dto";
import type { UpdateLessonDto } from "./dto/update-lesson.dto";

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLessonDto, actorId: string) {
    await this.assertParentExists(dto.moduleId);
    const slug = await this.resolveUniqueSlug(dto.moduleId, dto.slug ?? slugify(dto.title));
    const position = dto.position ?? (await this.nextPosition(dto.moduleId));

    return this.prisma.lesson.create({
      data: {
        moduleId: dto.moduleId,
        title: dto.title,
        slug,
        contentType: dto.contentType ?? "TEXT",
        body: dto.body,
        contentUrl: dto.contentUrl,
        durationMinutes: dto.durationMinutes,
        position,
        createdById: actorId,
      },
    });
  }

  async list(params: { moduleId: string; page: number; pageSize: number; status?: ContentStatus }) {
    const where: Prisma.LessonWhereInput = {
      deletedAt: null,
      moduleId: params.moduleId,
      ...(params.status ? { status: params.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lesson.findMany({
        where,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.lesson.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const lesson = await this.prisma.lesson.findFirst({ where: { id, deletedAt: null } });
    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }
    return lesson;
  }

  async update(id: string, dto: UpdateLessonDto) {
    const existing = await this.findByIdOrThrow(id);
    const slug =
      dto.slug !== undefined || dto.title !== undefined
        ? await this.resolveUniqueSlug(
            existing.moduleId,
            dto.slug ?? slugify(dto.title ?? existing.title),
            id,
          )
        : undefined;

    return this.prisma.lesson.update({
      where: { id },
      data: {
        title: dto.title,
        slug,
        contentType: dto.contentType,
        body: dto.body,
        contentUrl: dto.contentUrl,
        durationMinutes: dto.durationMinutes,
        position: dto.position,
      },
    });
  }

  async changeStatus(id: string, status: ContentStatus) {
    const existing = await this.findByIdOrThrow(id);
    assertValidStatusTransition(existing.status, status);
    return this.prisma.lesson.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    await this.findByIdOrThrow(id);
    await this.prisma.lesson.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Sets position = index for each id (FR-CONTENT-01 "reorder"). */
  async reorder(orderedIds: string[]): Promise<void> {
    const found = await this.prisma.lesson.findMany({
      where: { id: { in: orderedIds }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== orderedIds.length) {
      throw new NotFoundException("One or more lessons were not found");
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.lesson.update({ where: { id }, data: { position: index } }),
      ),
    );
  }

  private async assertParentExists(moduleId: string): Promise<void> {
    const parent = await this.prisma.module.findFirst({
      where: { id: moduleId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) {
      throw new BadRequestException("moduleId does not reference an existing module");
    }
  }

  private async nextPosition(moduleId: string): Promise<number> {
    const last = await this.prisma.lesson.findFirst({
      where: { deletedAt: null, moduleId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async resolveUniqueSlug(
    moduleId: string,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    const clash = await this.prisma.lesson.findFirst({
      where: {
        moduleId,
        slug: base,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(`A lesson with slug "${base}" already exists in this module`);
    }
    return base;
  }
}
