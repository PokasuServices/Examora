import { ForbiddenException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { AdminQuizAttemptsService } from "../../assessment/admin-monitoring/admin-quiz-attempts.service";
import { QuizAttemptsService } from "../../assessment/quiz-attempts/quiz-attempts.service";
import { QuizCatalogService } from "../../assessment/quiz-catalog/quiz-catalog.service";
import { AssignmentCatalogService } from "../../assignments/catalog/assignment-catalog.service";
import { MalwareScanQueueService } from "../../assignments/malware-scan-queue.service";
import { SubmissionsService } from "../../assignments/submissions/submissions.service";
import type { RequestUser } from "../../auth/types/request-user";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { CatalogService } from "../../learning/catalog.service";
import { ProgressService } from "../../learning/progress.service";
import { PermissionsService } from "../../permissions/permissions.service";
import { PrismaService } from "../../prisma/prisma.service";
import { STORAGE_PORT } from "../../storage/storage.port";
import { FakeStorageService } from "../../../test/support/fake-storage.service";
import { UsersService } from "../../users/users.service";
import { MentorAssignmentService } from "../assignment/mentor-assignment.service";
import { Student360Service } from "./student-360.service";

describe("Student360Service (integration)", () => {
  let service: Student360Service;
  let assignmentService: MentorAssignmentService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let mentorId: string;
  let strangerMentorId: string;
  let adminId: string;
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        Student360Service,
        UsersService,
        PermissionsService,
        ProgressService,
        CatalogService,
        AdminQuizAttemptsService,
        QuizAttemptsService,
        QuizCatalogService,
        SubmissionsService,
        AssignmentCatalogService,
        MentorAssignmentService,
        EnrollmentService,
        PrismaService,
        { provide: STORAGE_PORT, useClass: FakeStorageService },
        { provide: MalwareScanQueueService, useValue: { enqueue: async () => undefined } },
      ],
    }).compile();
    service = moduleRef.get(Student360Service);
    assignmentService = moduleRef.get(MentorAssignmentService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const mentorRole = await prisma.role.upsert({
      where: { name: "MENTOR" },
      update: {},
      create: { name: "MENTOR" },
    });

    const student = await prisma.user.create({
      data: { email: `s360-student-${suffix}@example.test`, status: "ACTIVE", firstName: "Sam" },
    });
    studentId = student.id;

    const mentor = await prisma.user.create({
      data: {
        email: `s360-mentor-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: mentorRole.id } },
      },
    });
    mentorId = mentor.id;

    const strangerMentor = await prisma.user.create({
      data: {
        email: `s360-stranger-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: mentorRole.id } },
      },
    });
    strangerMentorId = strangerMentor.id;

    const admin = await prisma.user.create({
      data: { email: `s360-admin-${suffix}@example.test`, status: "ACTIVE" },
    });
    adminId = admin.id;

    await assignmentService.assign(studentId, mentorId, adminId);

    await prisma.mentorNote.create({
      data: { studentId, mentorId, body: "Doing well overall" },
    });
  });

  afterAll(async () => {
    await prisma.mentorNote.deleteMany({ where: { studentId } });
    await prisma.mentorAssignment.deleteMany({ where: { studentId } });
    await prisma.user.deleteMany({
      where: { id: { in: [studentId, mentorId, strangerMentorId, adminId] } },
    });
    await moduleRef.close();
  });

  it("a non-assigned mentor is denied", async () => {
    const stranger: RequestUser = {
      id: strangerMentorId,
      email: "x@example.test",
      roles: ["MENTOR"],
    };
    await expect(service.getStudent360(stranger, studentId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("the assigned mentor gets a full aggregated view", async () => {
    const actor: RequestUser = { id: mentorId, email: "mentor@example.test", roles: ["MENTOR"] };
    const result = await service.getStudent360(actor, studentId);

    expect(result.profile.id).toBe(studentId);
    expect(result.profile.firstName).toBe("Sam");
    expect(result.currentMentor?.id).toBe(mentorId);
    expect(result.learningProgress).toBeDefined();
    expect(Array.isArray(result.quizHistory)).toBe(true);
    expect(Array.isArray(result.assignmentHistory)).toBe(true);
    expect(result.activityTimeline.some((item) => item.type === "MENTOR_NOTE")).toBe(true);
  });

  it("an admin can view any student's 360 without an assignment", async () => {
    const admin: RequestUser = {
      id: adminId,
      email: "admin@example.test",
      roles: ["ADMINISTRATOR"],
    };
    const result = await service.getStudent360(admin, studentId);
    expect(result.profile.id).toBe(studentId);
  });

  it("activity timeline is sorted newest first", async () => {
    const actor: RequestUser = { id: mentorId, email: "mentor@example.test", roles: ["MENTOR"] };
    const result = await service.getStudent360(actor, studentId);
    const timestamps = result.activityTimeline.map((item) => item.occurredAt);
    const sorted = [...timestamps].sort((a, b) => (a < b ? 1 : -1));
    expect(timestamps).toEqual(sorted);
  });
});
