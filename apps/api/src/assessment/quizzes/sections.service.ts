import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateQuizSectionDto } from "./dto/create-section.dto";
import type { UpdateQuizSectionDto } from "./dto/update-section.dto";

@Injectable()
export class QuizSectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(quizId: string, dto: CreateQuizSectionDto) {
    await this.assertQuizExists(quizId);
    const position = dto.position ?? (await this.nextPosition(quizId));
    return this.prisma.quizSection.create({
      data: { quizId, title: dto.title, description: dto.description, position },
    });
  }

  async list(quizId: string) {
    return this.prisma.quizSection.findMany({ where: { quizId }, orderBy: { position: "asc" } });
  }

  async findByIdOrThrow(quizId: string, id: string) {
    const section = await this.prisma.quizSection.findFirst({ where: { id, quizId } });
    if (!section) {
      throw new NotFoundException("Quiz section not found");
    }
    return section;
  }

  async update(quizId: string, id: string, dto: UpdateQuizSectionDto) {
    await this.findByIdOrThrow(quizId, id);
    return this.prisma.quizSection.update({
      where: { id },
      data: { title: dto.title, description: dto.description, position: dto.position },
    });
  }

  /** Deleting a section unassigns (does not delete) its questions — they fall back to no section. */
  async remove(quizId: string, id: string): Promise<void> {
    await this.findByIdOrThrow(quizId, id);
    await this.prisma.$transaction([
      this.prisma.quizQuestion.updateMany({ where: { sectionId: id }, data: { sectionId: null } }),
      this.prisma.quizSection.delete({ where: { id } }),
    ]);
  }

  async reorder(quizId: string, orderedIds: string[]): Promise<void> {
    const found = await this.prisma.quizSection.findMany({
      where: { id: { in: orderedIds }, quizId },
      select: { id: true },
    });
    if (found.length !== orderedIds.length) {
      throw new NotFoundException("One or more sections were not found in this quiz");
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.quizSection.update({ where: { id }, data: { position: index } }),
      ),
    );
  }

  private async assertQuizExists(quizId: string): Promise<void> {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: quizId, deletedAt: null },
      select: { id: true },
    });
    if (!quiz) {
      throw new NotFoundException("Quiz not found");
    }
  }

  private async nextPosition(quizId: string): Promise<number> {
    const last = await this.prisma.quizSection.findFirst({
      where: { quizId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }
}
