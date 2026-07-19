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
import type { CreateModuleDto } from "./dto/create-module.dto";
import type { UpdateModuleDto } from "./dto/update-module.dto";

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateModuleDto, actorId: string) {
    await this.assertParentExists(dto.topicId);
    const slug = await this.resolveUniqueSlug(dto.topicId, dto.slug ?? slugify(dto.title));
    const position = dto.position ?? (await this.nextPosition(dto.topicId));

    return this.prisma.module.create({
      data: {
        topicId: dto.topicId,
        title: dto.title,
        slug,
        description: dto.description,
        type: dto.type,
        position,
        createdById: actorId,
      },
    });
  }

  async list(params: { topicId: string; page: number; pageSize: number; status?: ContentStatus }) {
    const where: Prisma.ModuleWhereInput = {
      deletedAt: null,
      topicId: params.topicId,
      ...(params.status ? { status: params.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.module.findMany({
        where,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.module.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const found = await this.prisma.module.findFirst({ where: { id, deletedAt: null } });
    if (!found) {
      throw new NotFoundException("Module not found");
    }
    return found;
  }

  async update(id: string, dto: UpdateModuleDto) {
    const existing = await this.findByIdOrThrow(id);
    const slug =
      dto.slug !== undefined || dto.title !== undefined
        ? await this.resolveUniqueSlug(
            existing.topicId,
            dto.slug ?? slugify(dto.title ?? existing.title),
            id,
          )
        : undefined;

    return this.prisma.module.update({
      where: { id },
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        type: dto.type,
        position: dto.position,
      },
    });
  }

  async changeStatus(id: string, status: ContentStatus) {
    const existing = await this.findByIdOrThrow(id);
    assertValidStatusTransition(existing.status, status);
    return this.prisma.module.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    await this.findByIdOrThrow(id);
    await this.prisma.module.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Sets position = index for each id (FR-CONTENT-01 "reorder"). */
  async reorder(orderedIds: string[]): Promise<void> {
    const found = await this.prisma.module.findMany({
      where: { id: { in: orderedIds }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== orderedIds.length) {
      throw new NotFoundException("One or more modules were not found");
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.module.update({ where: { id }, data: { position: index } }),
      ),
    );
  }

  private async assertParentExists(topicId: string): Promise<void> {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, deletedAt: null },
      select: { id: true },
    });
    if (!topic) {
      throw new BadRequestException("topicId does not reference an existing topic");
    }
  }

  private async nextPosition(topicId: string): Promise<number> {
    const last = await this.prisma.module.findFirst({
      where: { deletedAt: null, topicId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async resolveUniqueSlug(
    topicId: string,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    const clash = await this.prisma.module.findFirst({
      where: {
        topicId,
        slug: base,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(`A module with slug "${base}" already exists in this topic`);
    }
    return base;
  }
}
