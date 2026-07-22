import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@examora/database";
import { slugify } from "@examora/utils";
import { PrismaService } from "../../prisma/prisma.service";
import { ForumCategoriesService } from "./forum-categories.service";
import type { CreateForumBoardDto } from "./dto/create-forum-board.dto";
import type { UpdateForumBoardDto } from "./dto/update-forum-board.dto";

const BOARD_INCLUDE = {
  category: { select: { title: true } },
  _count: { select: { threads: true } },
} as const;

/** Admin-managed forum boards within a category (ADR-0017). */
@Injectable()
export class ForumBoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: ForumCategoriesService,
  ) {}

  async create(dto: CreateForumBoardDto, actorId: string) {
    await this.categoriesService.findByIdOrThrow(dto.categoryId);
    const slug = await this.resolveUniqueSlug(dto.categoryId, dto.slug ?? slugify(dto.title));
    const position = dto.position ?? (await this.nextPosition(dto.categoryId));

    return this.prisma.forumBoard.create({
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        slug,
        description: dto.description,
        isActive: dto.isActive ?? true,
        position,
        createdById: actorId,
      },
      include: BOARD_INCLUDE,
    });
  }

  async list(params: { page: number; pageSize: number; categoryId?: string; isActive?: boolean }) {
    const where: Prisma.ForumBoardWhereInput = {
      deletedAt: null,
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.isActive === undefined ? {} : { isActive: params.isActive }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.forumBoard.findMany({
        where,
        include: BOARD_INCLUDE,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.forumBoard.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const board = await this.prisma.forumBoard.findFirst({
      where: { id, deletedAt: null },
      include: BOARD_INCLUDE,
    });
    if (!board) {
      throw new NotFoundException("Forum board not found");
    }
    return board;
  }

  async update(id: string, dto: UpdateForumBoardDto) {
    const existing = await this.findByIdOrThrow(id);
    const categoryId = dto.categoryId ?? existing.categoryId;
    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      await this.categoriesService.findByIdOrThrow(dto.categoryId);
    }

    const slug =
      dto.slug !== undefined || dto.title !== undefined || dto.categoryId !== undefined
        ? await this.resolveUniqueSlug(
            categoryId,
            dto.slug ?? slugify(dto.title ?? existing.title),
            id,
          )
        : undefined;

    return this.prisma.forumBoard.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        slug,
        description: dto.description,
        isActive: dto.isActive,
        position: dto.position,
      },
      include: BOARD_INCLUDE,
    });
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.prisma.forumBoard.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async nextPosition(categoryId: string): Promise<number> {
    const last = await this.prisma.forumBoard.findFirst({
      where: { categoryId, deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async resolveUniqueSlug(
    categoryId: string,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    const clash = await this.prisma.forumBoard.findFirst({
      where: {
        categoryId,
        slug: base,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) {
      return base;
    }
    throw new ConflictException(`A board with slug "${base}" already exists in this category`);
  }
}
