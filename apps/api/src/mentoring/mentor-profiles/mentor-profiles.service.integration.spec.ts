import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { MentorAssignmentService } from "../assignment/mentor-assignment.service";
import { MentorProfilesService } from "./mentor-profiles.service";

describe("MentorProfilesService (integration)", () => {
  let service: MentorProfilesService;
  let assignmentService: MentorAssignmentService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let mentorId: string;
  let nonMentorId: string;
  let studentId: string;
  let adminId: string;
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [MentorProfilesService, MentorAssignmentService, PrismaService],
    }).compile();
    service = moduleRef.get(MentorProfilesService);
    assignmentService = moduleRef.get(MentorAssignmentService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const mentorRole = await prisma.role.upsert({
      where: { name: "MENTOR" },
      update: {},
      create: { name: "MENTOR" },
    });

    const mentor = await prisma.user.create({
      data: {
        email: `mentor-profile-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: mentorRole.id } },
      },
    });
    mentorId = mentor.id;

    const nonMentor = await prisma.user.create({
      data: { email: `mentor-profile-nonmentor-${suffix}@example.test`, status: "ACTIVE" },
    });
    nonMentorId = nonMentor.id;

    const student = await prisma.user.create({
      data: { email: `mentor-profile-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student.id;

    const admin = await prisma.user.create({
      data: { email: `mentor-profile-admin-${suffix}@example.test`, status: "ACTIVE" },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    await prisma.mentorAssignment.deleteMany({ where: { studentId } });
    await prisma.mentorProfile.deleteMany({ where: { userId: { in: [mentorId, nonMentorId] } } });
    await prisma.user.deleteMany({
      where: { id: { in: [mentorId, nonMentorId, studentId, adminId] } },
    });
    await moduleRef.close();
  });

  it("rejects creating a profile for a user without the MENTOR role", async () => {
    await expect(service.create({ userId: nonMentorId })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("creates a mentor profile with a default maxStudents", async () => {
    const profile = await service.create({ userId: mentorId, bio: "Loves geometry" });
    expect(profile.userId).toBe(mentorId);
    expect(profile.maxStudents).toBe(10);
    expect(profile.bio).toBe("Loves geometry");
  });

  it("rejects creating a second profile for the same mentor", async () => {
    await expect(service.create({ userId: mentorId })).rejects.toBeInstanceOf(ConflictException);
  });

  it("updates a mentor profile's capacity", async () => {
    const profile = await service.findByUserIdOrThrow(mentorId);
    const updated = await service.update(profile.id, { maxStudents: 25 });
    expect(updated.maxStudents).toBe(25);
  });

  it("computes active student count from real assignments", async () => {
    await assignmentService.assign(studentId, mentorId, adminId);
    const count = await service.getActiveStudentCount(mentorId);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("findByIdOrThrow throws NotFoundException for a missing profile", async () => {
    await expect(
      service.findByIdOrThrow("00000000-0000-0000-0000-000000000000"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("removing a profile does not unassign existing students", async () => {
    const profile = await service.findByUserIdOrThrow(mentorId);
    await service.remove(profile.id);
    const activeMentorId = await assignmentService.getActiveMentorId(studentId);
    expect(activeMentorId).toBe(mentorId);
  });
});
