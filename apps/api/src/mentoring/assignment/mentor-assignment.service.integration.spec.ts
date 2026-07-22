import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../auth/types/request-user";
import { MentorAssignmentService } from "./mentor-assignment.service";

describe("MentorAssignmentService (integration)", () => {
  let service: MentorAssignmentService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let mentorId: string;
  let otherMentorId: string;
  let adminId: string;
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [MentorAssignmentService, PrismaService],
    }).compile();
    service = moduleRef.get(MentorAssignmentService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const mentorRole = await prisma.role.upsert({
      where: { name: "MENTOR" },
      update: {},
      create: { name: "MENTOR" },
    });

    const student = await prisma.user.create({
      data: { email: `mentor-assign-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student.id;

    const mentor = await prisma.user.create({
      data: {
        email: `mentor-assign-mentor-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: mentorRole.id } },
      },
    });
    mentorId = mentor.id;

    const otherMentor = await prisma.user.create({
      data: {
        email: `mentor-assign-other-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: mentorRole.id } },
      },
    });
    otherMentorId = otherMentor.id;

    const admin = await prisma.user.create({
      data: { email: `mentor-assign-admin-${suffix}@example.test`, status: "ACTIVE" },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    await prisma.mentorAssignment.deleteMany({ where: { studentId } });
    await prisma.user.deleteMany({
      where: { id: { in: [studentId, mentorId, otherMentorId, adminId] } },
    });
    await moduleRef.close();
  });

  it("rejects assigning a mentor who does not hold the MENTOR role", async () => {
    await expect(service.assign(studentId, studentId, adminId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("assigns a mentor and reports them as the active mentor", async () => {
    const assignment = await service.assign(studentId, mentorId, adminId);
    expect(assignment.mentorId).toBe(mentorId);
    expect(assignment.unassignedAt).toBeNull();

    const activeMentorId = await service.getActiveMentorId(studentId);
    expect(activeMentorId).toBe(mentorId);
  });

  it("reassigning supersedes the previous assignment without deleting it", async () => {
    await service.assign(studentId, mentorId, adminId);
    const reassignment = await service.assign(studentId, otherMentorId, adminId);
    expect(reassignment.mentorId).toBe(otherMentorId);

    const history = await service.listHistory({ studentId, page: 1, pageSize: 20 });
    expect(history.items.length).toBeGreaterThanOrEqual(2);
    const previous = history.items.find((a) => a.mentorId === mentorId);
    expect(previous?.unassignedAt).not.toBeNull();

    const activeMentorId = await service.getActiveMentorId(studentId);
    expect(activeMentorId).toBe(otherMentorId);
  });

  it("unassign clears the active mentor without assigning a replacement", async () => {
    await service.assign(studentId, mentorId, adminId);
    await service.unassign(studentId);
    const activeMentorId = await service.getActiveMentorId(studentId);
    expect(activeMentorId).toBeNull();
  });

  it("unassign throws when the student has no active assignment", async () => {
    await service.unassign(studentId).catch(() => undefined);
    await expect(service.unassign(studentId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("assertAssignedOrAdmin passes for an ADMINISTRATOR regardless of assignment", async () => {
    const admin: RequestUser = {
      id: adminId,
      email: "admin@example.test",
      roles: ["ADMINISTRATOR"],
    };
    await expect(service.assertAssignedOrAdmin(admin, studentId)).resolves.toBeUndefined();
  });

  it("assertAssignedOrAdmin passes for the student's actual assigned mentor", async () => {
    await service.assign(studentId, mentorId, adminId);
    const actor: RequestUser = { id: mentorId, email: "mentor@example.test", roles: ["MENTOR"] };
    await expect(service.assertAssignedOrAdmin(actor, studentId)).resolves.toBeUndefined();
  });

  it("assertAssignedOrAdmin throws for a mentor who is not this student's assigned mentor", async () => {
    await service.assign(studentId, mentorId, adminId);
    const actor: RequestUser = {
      id: otherMentorId,
      email: "other@example.test",
      roles: ["MENTOR"],
    };
    await expect(service.assertAssignedOrAdmin(actor, studentId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("getWorkload counts only active assignments", async () => {
    await service.assign(studentId, mentorId, adminId);
    const workload = await service.getWorkload(mentorId);
    expect(workload).toBeGreaterThanOrEqual(1);
  });
});
