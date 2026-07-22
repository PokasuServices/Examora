import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../auth/types/request-user";
import { MentorAssignmentService } from "../assignment/mentor-assignment.service";
import type { CreateNoteDto } from "./dto/create-note.dto";
import type { UpdateNoteDto } from "./dto/update-note.dto";

const NOTE_INCLUDE = { mentor: { select: { email: true } } } as const;

/** Private mentor notes about a student — never visible to the student (ADR-0016). */
@Injectable()
export class MentorNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentService: MentorAssignmentService,
  ) {}

  async list(actor: RequestUser, studentId: string) {
    await this.assignmentService.assertAssignedOrAdmin(actor, studentId);
    return this.prisma.mentorNote.findMany({
      where: { studentId },
      include: NOTE_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async create(actor: RequestUser, studentId: string, dto: CreateNoteDto) {
    await this.assignmentService.assertAssignedOrAdmin(actor, studentId);
    return this.prisma.mentorNote.create({
      data: { studentId, mentorId: actor.id, body: dto.body },
      include: NOTE_INCLUDE,
    });
  }

  async update(actor: RequestUser, studentId: string, noteId: string, dto: UpdateNoteDto) {
    await this.assignmentService.assertAssignedOrAdmin(actor, studentId);
    const note = await this.prisma.mentorNote.findUnique({ where: { id: noteId } });
    if (!note || note.studentId !== studentId) {
      throw new NotFoundException("Note not found");
    }
    return this.prisma.mentorNote.update({
      where: { id: noteId },
      data: { ...(dto.body !== undefined ? { body: dto.body } : {}) },
      include: NOTE_INCLUDE,
    });
  }

  async remove(actor: RequestUser, studentId: string, noteId: string): Promise<void> {
    await this.assignmentService.assertAssignedOrAdmin(actor, studentId);
    const note = await this.prisma.mentorNote.findUnique({ where: { id: noteId } });
    if (!note || note.studentId !== studentId) {
      throw new NotFoundException("Note not found");
    }
    await this.prisma.mentorNote.delete({ where: { id: noteId } });
  }
}
