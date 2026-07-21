import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@examora/database";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateTemplateDto } from "./dto/create-template.dto";
import type { UpdateTemplateDto } from "./dto/update-template.dto";

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTemplateDto, actorId: string) {
    return this.prisma.assignmentTemplate.create({
      data: {
        title: dto.title,
        brief: dto.brief,
        fileRules: dto.fileRules as unknown as Prisma.InputJsonValue,
        marksTotal: dto.marksTotal,
        rubric: dto.rubric as unknown as Prisma.InputJsonValue,
        createdById: actorId,
      },
    });
  }

  async list(params: { page: number; pageSize: number }) {
    const where = { deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.assignmentTemplate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.assignmentTemplate.count({ where }),
    ]);
    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const template = await this.prisma.assignmentTemplate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!template) {
      throw new NotFoundException("Template not found");
    }
    return template;
  }

  async update(id: string, dto: UpdateTemplateDto) {
    await this.findByIdOrThrow(id);
    return this.prisma.assignmentTemplate.update({
      where: { id },
      data: {
        title: dto.title,
        brief: dto.brief,
        fileRules: dto.fileRules as unknown as Prisma.InputJsonValue | undefined,
        marksTotal: dto.marksTotal,
        rubric: dto.rubric as unknown as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.prisma.assignmentTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
