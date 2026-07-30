import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/request-user";
import { fakeNotificationsServiceProvider } from "../../test/support/fake-notifications-service";
import { MentorAssignmentService } from "./assignment/mentor-assignment.service";
import { MentorFeedbackService } from "./feedback/mentor-feedback.service";
import { MentorMeetingsService } from "./meetings/mentor-meetings.service";
import { MentorNotesService } from "./notes/mentor-notes.service";
import { MentorTasksService } from "./tasks/mentor-tasks.service";

describe("Mentor workflow services (integration)", () => {
  let notes: MentorNotesService;
  let tasks: MentorTasksService;
  let feedback: MentorFeedbackService;
  let meetings: MentorMeetingsService;
  let assignmentService: MentorAssignmentService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let mentorId: string;
  let strangerMentorId: string;
  let adminId: string;
  const suffix = `${Date.now()}`;

  let mentorActor: RequestUser;
  let strangerActor: RequestUser;
  let adminActor: RequestUser;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        MentorNotesService,
        MentorTasksService,
        MentorFeedbackService,
        MentorMeetingsService,
        MentorAssignmentService,
        PrismaService,
        fakeNotificationsServiceProvider(),
      ],
    }).compile();
    notes = moduleRef.get(MentorNotesService);
    tasks = moduleRef.get(MentorTasksService);
    feedback = moduleRef.get(MentorFeedbackService);
    meetings = moduleRef.get(MentorMeetingsService);
    assignmentService = moduleRef.get(MentorAssignmentService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const mentorRole = await prisma.role.upsert({
      where: { name: "MENTOR" },
      update: {},
      create: { name: "MENTOR" },
    });

    const student = await prisma.user.create({
      data: { email: `workflow-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student.id;

    const mentor = await prisma.user.create({
      data: {
        email: `workflow-mentor-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: mentorRole.id } },
      },
    });
    mentorId = mentor.id;

    const strangerMentor = await prisma.user.create({
      data: {
        email: `workflow-stranger-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: mentorRole.id } },
      },
    });
    strangerMentorId = strangerMentor.id;

    const admin = await prisma.user.create({
      data: { email: `workflow-admin-${suffix}@example.test`, status: "ACTIVE" },
    });
    adminId = admin.id;

    await assignmentService.assign(studentId, mentorId, adminId);

    mentorActor = { id: mentorId, email: mentor.email, roles: ["MENTOR"] };
    strangerActor = { id: strangerMentorId, email: strangerMentor.email, roles: ["MENTOR"] };
    adminActor = { id: adminId, email: admin.email, roles: ["ADMINISTRATOR"] };
  });

  afterAll(async () => {
    await prisma.mentorNote.deleteMany({ where: { studentId } });
    await prisma.mentorTask.deleteMany({ where: { studentId } });
    await prisma.mentorFeedback.deleteMany({ where: { studentId } });
    await prisma.mentorMeeting.deleteMany({ where: { studentId } });
    await prisma.mentorAssignment.deleteMany({ where: { studentId } });
    await prisma.user.deleteMany({
      where: { id: { in: [studentId, mentorId, strangerMentorId, adminId] } },
    });
    await moduleRef.close();
  });

  describe("MentorNotesService", () => {
    it("a non-assigned mentor cannot create a note", async () => {
      await expect(notes.create(strangerActor, studentId, { body: "nope" })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("the assigned mentor can create, list, update and delete a note", async () => {
      const note = await notes.create(mentorActor, studentId, { body: "Struggles with fractions" });
      expect(note.mentorId).toBe(mentorId);

      const list = await notes.list(mentorActor, studentId);
      expect(list.some((n) => n.id === note.id)).toBe(true);

      const updated = await notes.update(mentorActor, studentId, note.id, {
        body: "Improving on fractions",
      });
      expect(updated.body).toBe("Improving on fractions");

      await notes.remove(mentorActor, studentId, note.id);
      await expect(
        notes.update(mentorActor, studentId, note.id, { body: "x" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("an admin can create a note for any student", async () => {
      const note = await notes.create(adminActor, studentId, { body: "Admin oversight note" });
      expect(note.studentId).toBe(studentId);
    });
  });

  describe("MentorTasksService", () => {
    it("creates a task and updating status sets completedAt", async () => {
      const task = await tasks.create(mentorActor, studentId, {
        title: "Finish worksheet 3",
        dueDate: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(task.status).toBe("PENDING");
      expect(task.completedAt).toBeNull();

      const completed = await tasks.update(mentorActor, studentId, task.id, {
        status: "COMPLETED",
      });
      expect(completed.status).toBe("COMPLETED");
      expect(completed.completedAt).not.toBeNull();
    });

    it("a non-assigned mentor cannot list tasks", async () => {
      await expect(tasks.list(strangerActor, studentId)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("MentorFeedbackService", () => {
    it("the assigned mentor can share and list feedback", async () => {
      const item = await feedback.create(mentorActor, studentId, {
        body: "Great improvement this week",
      });
      const list = await feedback.list(mentorActor, studentId);
      expect(list.some((f) => f.id === item.id)).toBe(true);
    });
  });

  describe("MentorMeetingsService", () => {
    it("the assigned mentor can log and list a meeting", async () => {
      const meeting = await meetings.create(mentorActor, studentId, {
        occurredAt: new Date().toISOString(),
        durationMinutes: 30,
        summary: "Discussed progress",
      });
      const list = await meetings.list(mentorActor, studentId);
      expect(list.some((m) => m.id === meeting.id)).toBe(true);
    });

    it("a non-assigned mentor cannot log a meeting", async () => {
      await expect(
        meetings.create(strangerActor, studentId, { occurredAt: new Date().toISOString() }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
