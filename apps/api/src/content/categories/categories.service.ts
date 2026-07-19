import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@examora/database";
import { slugify } from "@examora/utils";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto, actorId: string) {
    const slug = await this.resolveUniqueSlug(dto.slug ?? slugify(dto.name));
    const position = dto.position ?? (await this.nextPosition());

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        isActive: dto.isActive ?? true,
        position,
        createdById: actorId,
      },
    });
  }

  async list(params: { page: number; pageSize: number; isActive?: boolean }) {
    const where: Prisma.CategoryWhereInput = {
      deletedAt: null,
      ...(params.isActive === undefined ? {} : { isActive: params.isActive }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.category.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const category = await this.prisma.category.findFirst({ where: { id, deletedAt: null } });
    if (!category) {
      throw new NotFoundException("Category not found");
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.findByIdOrThrow(id);

    const slug =
      dto.slug !== undefined || dto.name !== undefined
        ? await this.resolveUniqueSlug(dto.slug ?? slugify(dto.name ?? existing.name), id)
        : undefined;

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        isActive: dto.isActive,
        position: dto.position,
      },
    });
  }

  async remove(id: string) {
    await this.findByIdOrThrow(id);
    // Soft delete (MDG-00 §10). Courses keep their category_id but SetNull would
    // only fire on a hard delete — so surviving courses simply reference a
    // soft-deleted category, which list queries exclude.
    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Sets position = index for each id (FR-CONTENT-01 "reorder"). */
  async reorder(orderedIds: string[]): Promise<void> {
    const found = await this.prisma.category.findMany({
      where: { id: { in: orderedIds }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== orderedIds.length) {
      throw new NotFoundException("One or more categories were not found");
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.category.update({ where: { id }, data: { position: index } }),
      ),
    );
  }

  private async nextPosition(): Promise<number> {
    const last = await this.prisma.category.findFirst({
      where: { deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async resolveUniqueSlug(base: string, excludeId?: string): Promise<string> {
    const clash = await this.prisma.category.findFirst({
      where: { slug: base, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) {
      return base;
    }
    throw new ConflictException(`A category with slug "${base}" already exists`);
  }
}
