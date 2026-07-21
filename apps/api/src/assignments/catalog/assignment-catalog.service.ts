import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const PUBLISHED = { status: "PUBLISHED" as const, deletedAt: null };

/** Student-facing read access to PUBLISHED assignments (ADR-0015, mirrors QuizCatalogService). */
@Injectable()
export class AssignmentCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(params: { page: number; pageSize: number; subjectId?: string }) {
    const where = { ...PUBLISHED, ...(params.subjectId ? { subjectId: params.subjectId } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.assignment.findMany({
        where,
        include: { criteria: { select: { id: true } } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.assignment.count({ where }),
    ]);
    return { items, total };
  }

  async getPublishedOrThrow(id: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, ...PUBLISHED },
      include: { criteria: { orderBy: { position: "asc" } } },
    });
    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }
    return assignment;
  }
}
