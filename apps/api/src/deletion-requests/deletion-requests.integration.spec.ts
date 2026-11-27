import { BadRequestException, ConflictException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { QuestionsService } from "../assessment/question-bank/questions.service";
import { QuizzesService } from "../assessment/quizzes/quizzes.service";
import { AssignmentsAdminService } from "../assignments/authoring/assignments-admin.service";
import { TemplatesService } from "../assignments/templates/templates.service";
import { AuditService } from "../audit/audit.service";
import { CollegesService } from "../colleges/colleges.service";
import { CategoriesService } from "../content/categories/categories.service";
import { CoursesService } from "../content/courses/courses.service";
import { LessonsService } from "../content/lessons/lessons.service";
import { ModulesService } from "../content/modules/modules.service";
import { SubjectsService } from "../content/subjects/subjects.service";
import { TopicsService } from "../content/topics/topics.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PracticeService } from "../practice/practice.service";
import { PrismaService } from "../prisma/prisma.service";
import { SketchWorksService } from "../sketches/sketch-works.service";
import { StudentProfileService } from "../student-profile/student-profile.service";
import { DeletionRequestsService } from "./deletion-requests.service";
import { DeletionTargets } from "./deletion-targets";
import { StaffScopeService } from "../staff/staff-scope.service";

/** Mentor asks → admin approves (record deleted) or rejects (record kept). */
describe("DeletionRequestsService (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let requests: DeletionRequestsService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let mentorId: string;
  let adminId: string;
  let courseId: string;
  let topicId: string;
  let cohortId: string;
  const sent: { userId: string; eventType: string; title: string }[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        DeletionRequestsService,
        DeletionTargets,
        PrismaService,
        AuditService,
        TopicsService,
        {
          provide: NotificationsService,
          useValue: { enqueue: async (n: (typeof sent)[number]) => sent.push(n) },
        },
        // Not exercised here: only their constructors are needed.
        ...[
          CategoriesService,
          CoursesService,
          SubjectsService,
          ModulesService,
          LessonsService,
          QuestionsService,
          QuizzesService,
          AssignmentsAdminService,
          TemplatesService,
          PracticeService,
          SketchWorksService,
          StudentProfileService,
          StaffScopeService,
          CollegesService,
        ].map((provide) => ({ provide, useValue: {} })),
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    requests = moduleRef.get(DeletionRequestsService);
    await prisma.$connect();

    mentorId = (
      await prisma.user.create({
        data: { email: `dr-m-${suffix}@example.test`, firstName: "Meera", status: "ACTIVE" },
      })
    ).id;
    adminId = (
      await prisma.user.create({ data: { email: `dr-a-${suffix}@example.test`, status: "ACTIVE" } })
    ).id;
    courseId = (
      await prisma.course.create({
        data: { title: "DR", slug: `dr-${suffix}`, status: "PUBLISHED" },
      })
    ).id;
    const subject = await prisma.subject.create({
      data: { courseId, title: "S", slug: "s", status: "PUBLISHED" },
    });
    topicId = (
      await prisma.topic.create({
        data: { subjectId: subject.id, title: "Old puzzles", slug: "old" },
      })
    ).id;
    await prisma.module.create({ data: { topicId, title: "M", slug: "m" } });
    cohortId = (await prisma.cohort.create({ data: { name: `DR batch ${suffix}` } })).id;
  });

  afterAll(async () => {
    await prisma.deletionRequest.deleteMany({ where: { requestedById: mentorId } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [mentorId, adminId] } } });
    await prisma.cohort.deleteMany({ where: { id: cohortId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: { in: [mentorId, adminId] } } });
    await moduleRef.close();
  });

  it("previews what deleting would affect", async () => {
    const p = await requests.preview("topic", topicId);
    expect(p).toMatchObject({ label: "Old puzzles", pendingRequestId: null });
    expect(p.impact).toEqual([{ label: "Modules", count: 1 }]);
  });

  it("sends one request per record, and an admin approval really deletes it", async () => {
    const req = await requests.create(
      mentorId,
      "topic",
      topicId,
      "Replaced by the new Puzzles topic",
    );
    expect(req).toMatchObject({ status: "PENDING", targetLabel: "Old puzzles" });
    expect(req.requestedBy.name).toBe("Meera");
    await expect(
      requests.create(mentorId, "topic", topicId, "Asking again"),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((await requests.preview("topic", topicId)).pendingRequestId).toBe(req.id);

    const done = await requests.approve(adminId, req.id, "Thanks");
    expect(done.status).toBe("APPROVED");
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      select: { deletedAt: true },
    });
    expect(topic?.deletedAt).not.toBeNull();
    await expect(requests.approve(adminId, req.id)).rejects.toBeInstanceOf(ConflictException);
    expect(
      sent.some((n) => n.userId === mentorId && n.eventType === "staff.deletion_approved"),
    ).toBe(true);
  });

  it("rejects with a reason and keeps the record", async () => {
    const req = await requests.create(
      mentorId,
      "batch",
      cohortId,
      "Batch merged into the evening one",
    );
    await expect(requests.reject(adminId, req.id, "  ")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const done = await requests.reject(adminId, req.id, "Students still attend it");
    expect(done).toMatchObject({ status: "REJECTED", decisionNote: "Students still attend it" });
    expect(await prisma.cohort.count({ where: { id: cohortId } })).toBe(1);
    expect((await requests.listMine(mentorId)).map((r) => r.status)).toEqual([
      "REJECTED",
      "APPROVED",
    ]);
  });
});
