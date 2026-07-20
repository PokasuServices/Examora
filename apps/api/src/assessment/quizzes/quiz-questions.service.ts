import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { AssignQuestionDto } from "./dto/assign-question.dto";
import type { UpdateQuizQuestionDto } from "./dto/update-quiz-question.dto";

const QUESTION_PREVIEW = { question: { select: { text: true, type: true, difficulty: true } } };

@Injectable()
export class QuizQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Only PUBLISHED questions may be assigned (ADR-0014 authoring integrity gate). */
  async assign(quizId: string, dto: AssignQuestionDto) {
    await this.assertQuizExists(quizId);

    const question = await this.prisma.question.findFirst({
      where: { id: dto.questionId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!question) {
      throw new BadRequestException("questionId does not reference an existing question");
    }
    if (question.status !== "PUBLISHED") {
      throw new BadRequestException("Only PUBLISHED questions can be assigned to a quiz");
    }
    if (dto.sectionId) {
      await this.assertSectionInQuiz(quizId, dto.sectionId);
    }

    const existing = await this.prisma.quizQuestion.findUnique({
      where: { quizId_questionId: { quizId, questionId: dto.questionId } },
    });
    if (existing) {
      throw new ConflictException("This question is already assigned to this quiz");
    }

    const position = dto.position ?? (await this.nextPosition(quizId));
    return this.prisma.quizQuestion.create({
      data: {
        quizId,
        questionId: dto.questionId,
        sectionId: dto.sectionId,
        marks: dto.marks ?? 1,
        position,
      },
      include: QUESTION_PREVIEW,
    });
  }

  async update(quizId: string, id: string, dto: UpdateQuizQuestionDto) {
    const existing = await this.findByIdOrThrow(quizId, id);
    if (dto.sectionId) {
      await this.assertSectionInQuiz(quizId, dto.sectionId);
    }
    return this.prisma.quizQuestion.update({
      where: { id: existing.id },
      data: { sectionId: dto.sectionId, marks: dto.marks, position: dto.position },
      include: QUESTION_PREVIEW,
    });
  }

  async unassign(quizId: string, id: string): Promise<void> {
    await this.findByIdOrThrow(quizId, id);
    await this.prisma.quizQuestion.delete({ where: { id } });
  }

  async reorder(quizId: string, orderedIds: string[]): Promise<void> {
    const found = await this.prisma.quizQuestion.findMany({
      where: { id: { in: orderedIds }, quizId },
      select: { id: true },
    });
    if (found.length !== orderedIds.length) {
      throw new NotFoundException("One or more assignments were not found in this quiz");
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.quizQuestion.update({ where: { id }, data: { position: index } }),
      ),
    );
  }

  private async findByIdOrThrow(quizId: string, id: string) {
    const row = await this.prisma.quizQuestion.findFirst({ where: { id, quizId } });
    if (!row) {
      throw new NotFoundException("Quiz-question assignment not found");
    }
    return row;
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

  private async assertSectionInQuiz(quizId: string, sectionId: string): Promise<void> {
    const section = await this.prisma.quizSection.findFirst({
      where: { id: sectionId, quizId },
      select: { id: true },
    });
    if (!section) {
      throw new BadRequestException("sectionId does not reference a section in this quiz");
    }
  }

  private async nextPosition(quizId: string): Promise<number> {
    const last = await this.prisma.quizQuestion.findFirst({
      where: { quizId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }
}
