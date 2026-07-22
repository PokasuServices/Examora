import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../auth/types/request-user";
import { MentorAssignmentService } from "../assignment/mentor-assignment.service";
import type { CreateTaskDto } from "./dto/create-task.dto";
import type { UpdateTaskDto } from "./dto/update-task.dto";

const TASK_INCLUDE = { mentor: { select: { email: true } } } as const;

/** A task a mentor assigns to a student, with a due date (ADR-0016). */
@Injectable()
export class MentorTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentService: MentorAssignmentService,
  ) {}

  async list(actor: RequestUser, studentId: string) {
    await this.assignmentService.assertAssignedOrAdmin(actor, studentId);
    return this.prisma.mentorTask.findMany({
      where: { studentId },
      include: TASK_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async create(actor: RequestUser, studentId: string, dto: CreateTaskDto) {
    await this.assignmentService.assertAssignedOrAdmin(actor, studentId);
    return this.prisma.mentorTask.create({
      data: {
        studentId,
        mentorId: actor.id,
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: TASK_INCLUDE,
    });
  }

  async update(actor: RequestUser, studentId: string, taskId: string, dto: UpdateTaskDto) {
    await this.assignmentService.assertAssignedOrAdmin(actor, studentId);
    const task = await this.prisma.mentorTask.findUnique({ where: { id: taskId } });
    if (!task || task.studentId !== studentId) {
      throw new NotFoundException("Task not found");
    }
    return this.prisma.mentorTask.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(dto.status !== undefined
          ? { status: dto.status, completedAt: dto.status === "COMPLETED" ? new Date() : null }
          : {}),
      },
      include: TASK_INCLUDE,
    });
  }

  async remove(actor: RequestUser, studentId: string, taskId: string): Promise<void> {
    await this.assignmentService.assertAssignedOrAdmin(actor, studentId);
    const task = await this.prisma.mentorTask.findUnique({ where: { id: taskId } });
    if (!task || task.studentId !== studentId) {
      throw new NotFoundException("Task not found");
    }
    await this.prisma.mentorTask.delete({ where: { id: taskId } });
  }
}
