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
import type { CreateSubjectDto } from "./dto/create-subject.dto";
import type { UpdateSubjectDto } from "./dto/update-subject.dto";

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubjectDto, actorId: string) {
    await this.assertParentExists(dto.courseId);
    const slug = await this.resolveUniqueSlug(dto.courseId, dto.slug ?? slugify(dto.title));
    const position = dto.position ?? (await this.nextPosition(dto.courseId));

    return this.prisma.subject.create({
      data: {
        courseId: dto.courseId,
        title: dto.title,
        slug,
        description: dto.description,
        position,
        createdById: actorId,
      },
    });
  }

  async list(params: { courseId: string; page: number; pageSize: number; status?: ContentStatus }) {
    const where: Prisma.SubjectWhereInput = {
      deletedAt: null,
      courseId: params.courseId,
      ...(params.status ? { status: params.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subject.findMany({
        where,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.subject.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const subject = await this.prisma.subject.findFirst({ where: { id, deletedAt: null } });
    if (!subject) {
      throw new NotFoundException("Subject not found");
    }
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto) {
    const existing = await this.findByIdOrThrow(id);
    const slug =
      dto.slug !== undefined || dto.title !== undefined
        ? await this.resolveUniqueSlug(
            existing.courseId,
            dto.slug ?? slugify(dto.title ?? existing.title),
            id,
          )
        : undefined;

    return this.prisma.subject.update({
      where: { id },
      data: { title: dto.title, slug, description: dto.description, position: dto.position },
    });
  }

  async changeStatus(id: string, status: ContentStatus) {
    const existing = await this.findByIdOrThrow(id);
    assertValidStatusTransition(existing.status, status);
    return this.prisma.subject.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    await this.findByIdOrThrow(id);
    await this.prisma.subject.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Sets position = index for each id (FR-CONTENT-01 "reorder"). */
  async reorder(orderedIds: string[]): Promise<void> {
    const found = await this.prisma.subject.findMany({
      where: { id: { in: orderedIds }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== orderedIds.length) {
      throw new NotFoundException("One or more subjects were not found");
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.subject.update({ where: { id }, data: { position: index } }),
      ),
    );
  }

  private async assertParentExists(courseId: string): Promise<void> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, deletedAt: null },
      select: { id: true },
    });
    if (!course) {
      throw new BadRequestException("courseId does not reference an existing course");
    }
  }

  private async nextPosition(courseId: string): Promise<number> {
    const last = await this.prisma.subject.findFirst({
      where: { deletedAt: null, courseId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async resolveUniqueSlug(
    courseId: string,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    const clash = await this.prisma.subject.findFirst({
      where: {
        courseId,
        slug: base,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(`A subject with slug "${base}" already exists in this course`);
    }
    return base;
  }
}
