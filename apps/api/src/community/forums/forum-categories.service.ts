import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@examora/database";
import { slugify } from "@examora/utils";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateForumCategoryDto } from "./dto/create-forum-category.dto";
import type { UpdateForumCategoryDto } from "./dto/update-forum-category.dto";

const CATEGORY_INCLUDE = { _count: { select: { boards: true } } } as const;

/** Admin-managed forum categories (ADR-0017) — mirrors Sprint 2's CategoriesService. */
@Injectable()
export class ForumCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateForumCategoryDto, actorId: string) {
    const slug = await this.resolveUniqueSlug(dto.slug ?? slugify(dto.title));
    const position = dto.position ?? (await this.nextPosition());

    return this.prisma.forumCategory.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        isActive: dto.isActive ?? true,
        position,
        createdById: actorId,
      },
      include: CATEGORY_INCLUDE,
    });
  }

  async list(params: { page: number; pageSize: number; isActive?: boolean }) {
    const where: Prisma.ForumCategoryWhereInput = {
      deletedAt: null,
      ...(params.isActive === undefined ? {} : { isActive: params.isActive }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.forumCategory.findMany({
        where,
        include: CATEGORY_INCLUDE,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.forumCategory.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const category = await this.prisma.forumCategory.findFirst({
      where: { id, deletedAt: null },
      include: CATEGORY_INCLUDE,
    });
    if (!category) {
      throw new NotFoundException("Forum category not found");
    }
    return category;
  }

  async update(id: string, dto: UpdateForumCategoryDto) {
    const existing = await this.findByIdOrThrow(id);

    const slug =
      dto.slug !== undefined || dto.title !== undefined
        ? await this.resolveUniqueSlug(dto.slug ?? slugify(dto.title ?? existing.title), id)
        : undefined;

    return this.prisma.forumCategory.update({
      where: { id },
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        isActive: dto.isActive,
        position: dto.position,
      },
      include: CATEGORY_INCLUDE,
    });
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    // Soft delete, same rationale as Sprint 2's Category: boards/threads keep
    // their categoryId/boardId but a soft-deleted category is excluded from
    // catalog listings.
    await this.prisma.forumCategory.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async nextPosition(): Promise<number> {
    const last = await this.prisma.forumCategory.findFirst({
      where: { deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async resolveUniqueSlug(base: string, excludeId?: string): Promise<string> {
    const clash = await this.prisma.forumCategory.findFirst({
      where: { slug: base, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) {
      return base;
    }
    throw new ConflictException(`A forum category with slug "${base}" already exists`);
  }
}
