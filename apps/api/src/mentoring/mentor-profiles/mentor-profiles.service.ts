import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MentorAssignmentService } from "../assignment/mentor-assignment.service";
import type { CreateMentorProfileDto } from "./dto/create-mentor-profile.dto";
import type { UpdateMentorProfileDto } from "./dto/update-mentor-profile.dto";

const PROFILE_INCLUDE = {
  user: { select: { email: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class MentorProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentService: MentorAssignmentService,
  ) {}

  async create(dto: CreateMentorProfileDto) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: dto.userId },
      include: { role: true },
    });
    if (!userRoles.some((ur) => ur.role.name === "MENTOR")) {
      throw new BadRequestException("userId must belong to a user with the MENTOR role");
    }

    const existing = await this.prisma.mentorProfile.findUnique({ where: { userId: dto.userId } });
    if (existing) {
      throw new ConflictException("This user already has a mentor profile");
    }

    return this.prisma.mentorProfile.create({
      data: {
        userId: dto.userId,
        bio: dto.bio,
        specialization: dto.specialization,
        maxStudents: dto.maxStudents ?? 10,
      },
      include: PROFILE_INCLUDE,
    });
  }

  async findByIdOrThrow(id: string) {
    const profile = await this.prisma.mentorProfile.findUnique({
      where: { id },
      include: PROFILE_INCLUDE,
    });
    if (!profile) {
      throw new NotFoundException("Mentor profile not found");
    }
    return profile;
  }

  async findByUserIdOrThrow(userId: string) {
    const profile = await this.prisma.mentorProfile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });
    if (!profile) {
      throw new NotFoundException("Mentor profile not found");
    }
    return profile;
  }

  async list(params: { page: number; pageSize: number }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mentorProfile.findMany({
        include: PROFILE_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.mentorProfile.count(),
    ]);
    return { items, total };
  }

  async update(id: string, dto: UpdateMentorProfileDto) {
    await this.findByIdOrThrow(id);
    return this.prisma.mentorProfile.update({
      where: { id },
      data: {
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.specialization !== undefined ? { specialization: dto.specialization } : {}),
        ...(dto.maxStudents !== undefined ? { maxStudents: dto.maxStudents } : {}),
      },
      include: PROFILE_INCLUDE,
    });
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.prisma.mentorProfile.delete({ where: { id } });
  }

  async getActiveStudentCount(mentorUserId: string): Promise<number> {
    return this.assignmentService.getWorkload(mentorUserId);
  }
}
