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
import type { CreateTopicDto } from "./dto/create-topic.dto";
import type { UpdateTopicDto } from "./dto/update-topic.dto";

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTopicDto, actorId: string) {
    await this.assertParentExists(dto.subjectId);
    const slug = await this.resolveUniqueSlug(dto.subjectId, dto.slug ?? slugify(dto.title));
    const position = dto.position ?? (await this.nextPosition(dto.subjectId));

    return this.prisma.topic.create({
      data: {
        subjectId: dto.subjectId,
        title: dto.title,
        slug,
        description: dto.description,
        position,
        createdById: actorId,
      },
    });
  }

  async list(params: {
    subjectId: string;
    page: number;
    pageSize: number;
    status?: ContentStatus;
  }) {
    const where: Prisma.TopicWhereInput = {
      deletedAt: null,
      subjectId: params.subjectId,
      ...(params.status ? { status: params.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.topic.findMany({
        where,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.topic.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const topic = await this.prisma.topic.findFirst({ where: { id, deletedAt: null } });
    if (!topic) {
      throw new NotFoundException("Topic not found");
    }
    return topic;
  }

  async update(id: string, dto: UpdateTopicDto) {
    const existing = await this.findByIdOrThrow(id);
    const slug =
      dto.slug !== undefined || dto.title !== undefined
        ? await this.resolveUniqueSlug(
            existing.subjectId,
            dto.slug ?? slugify(dto.title ?? existing.title),
            id,
          )
        : undefined;

    return this.prisma.topic.update({
      where: { id },
      data: { title: dto.title, slug, description: dto.description, position: dto.position },
    });
  }

  async changeStatus(id: string, status: ContentStatus) {
    const existing = await this.findByIdOrThrow(id);
    assertValidStatusTransition(existing.status, status);
    return this.prisma.topic.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    await this.findByIdOrThrow(id);
    await this.prisma.topic.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Sets position = index for each id (FR-CONTENT-01 "reorder"). */
  async reorder(orderedIds: string[]): Promise<void> {
    const found = await this.prisma.topic.findMany({
      where: { id: { in: orderedIds }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== orderedIds.length) {
      throw new NotFoundException("One or more topics were not found");
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.topic.update({ where: { id }, data: { position: index } }),
      ),
    );
  }

  private async assertParentExists(subjectId: string): Promise<void> {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, deletedAt: null },
      select: { id: true },
    });
    if (!subject) {
      throw new BadRequestException("subjectId does not reference an existing subject");
    }
  }

  private async nextPosition(subjectId: string): Promise<number> {
    const last = await this.prisma.topic.findFirst({
      where: { deletedAt: null, subjectId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async resolveUniqueSlug(
    subjectId: string,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    const clash = await this.prisma.topic.findFirst({
      where: {
        subjectId,
        slug: base,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(`A topic with slug "${base}" already exists in this subject`);
    }
    return base;
  }
}
