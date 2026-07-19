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
import type { CreateCourseDto } from "./dto/create-course.dto";
import type { UpdateCourseDto } from "./dto/update-course.dto";

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCourseDto, actorId: string) {
    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    const slug = await this.resolveUniqueSlug(dto.slug ?? slugify(dto.title));
    const position = dto.position ?? (await this.nextPosition(dto.categoryId));

    return this.prisma.course.create({
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        slug,
        description: dto.description,
        examType: dto.examType,
        position,
        createdById: actorId,
        // status defaults to DRAFT (schema default).
      },
    });
  }

  async list(params: {
    page: number;
    pageSize: number;
    status?: ContentStatus;
    categoryId?: string;
    examType?: string;
  }) {
    const where: Prisma.CourseWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.examType ? { examType: params.examType } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.course.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const course = await this.prisma.course.findFirst({ where: { id, deletedAt: null } });
    if (!course) {
      throw new NotFoundException("Course not found");
    }
    return course;
  }

  async update(id: string, dto: UpdateCourseDto) {
    const existing = await this.findByIdOrThrow(id);

    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    const slug =
      dto.slug !== undefined || dto.title !== undefined
        ? await this.resolveUniqueSlug(dto.slug ?? slugify(dto.title ?? existing.title), id)
        : undefined;

    return this.prisma.course.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        slug,
        description: dto.description,
        examType: dto.examType,
        position: dto.position,
      },
    });
  }

  async changeStatus(id: string, status: ContentStatus) {
    const existing = await this.findByIdOrThrow(id);
    assertValidStatusTransition(existing.status, status);

    return this.prisma.course.update({
      where: { id },
      data: {
        status,
        // Stamp publishedAt on first publish; leave it once set so re-publishing
        // after an unpublish keeps the original publication date.
        publishedAt:
          status === "PUBLISHED" && !existing.publishedAt ? new Date() : existing.publishedAt,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.findByIdOrThrow(id);
    // A published course must be archived before it can be deleted — deleting
    // live content out from under students (later sprints) should be deliberate.
    if (existing.status === "PUBLISHED") {
      throw new BadRequestException("Archive the course before deleting it");
    }
    await this.prisma.course.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Sets position = index for each id (FR-CONTENT-01 "reorder"). */
  async reorder(orderedIds: string[]): Promise<void> {
    const found = await this.prisma.course.findMany({
      where: { id: { in: orderedIds }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== orderedIds.length) {
      throw new NotFoundException("One or more courses were not found");
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.course.update({ where: { id }, data: { position: index } }),
      ),
    );
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, deletedAt: null },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException("categoryId does not reference an existing category");
    }
  }

  private async nextPosition(categoryId?: string): Promise<number> {
    const last = await this.prisma.course.findFirst({
      where: { deletedAt: null, categoryId: categoryId ?? null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async resolveUniqueSlug(base: string, excludeId?: string): Promise<string> {
    const clash = await this.prisma.course.findFirst({
      where: { slug: base, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(`A course with slug "${base}" already exists`);
    }
    return base;
  }
}
