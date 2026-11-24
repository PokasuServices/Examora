import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { assignmentState, MentorCoursesService } from "./mentor-courses.service";

describe("assignmentState", () => {
  it("buckets the latest submission status", () => {
    expect(assignmentState(undefined)).toBe("notStarted");
    expect(assignmentState("DRAFT")).toBe("draft");
    expect(assignmentState("SUBMITTED")).toBe("awaitingReview");
    expect(assignmentState("UNDER_REVIEW")).toBe("awaitingReview");
    expect(assignmentState("REVISION_REQUESTED")).toBe("revisionRequested");
    expect(assignmentState("APPROVED")).toBe("approved");
  });
});

/** Mentor course progress: only current, licensed students; latest submission wins. */
describe("MentorCoursesService (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let service: MentorCoursesService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userIds: string[] = [];
  let mentorId: string;
  let mine: string;
  let unassigned: string;
  let courseId: string;
  let otherCourseId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [MentorCoursesService, PrismaService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(MentorCoursesService);
    await prisma.$connect();

    const mk = async (label: string) => {
      const u = await prisma.user.create({
        data: { email: `mc-${label}-${suffix}@example.test`, firstName: label, status: "ACTIVE" },
      });
      userIds.push(u.id);
      return u.id;
    };
    mentorId = await mk("mentor");
    mine = await mk("mine");
    unassigned = await mk("former");

    courseId = (
      await prisma.course.create({
        data: { title: "MC course", slug: `mc-${suffix}`, status: "PUBLISHED" },
      })
    ).id;
    otherCourseId = (
      await prisma.course.create({
        data: { title: "MC other", slug: `mc-other-${suffix}`, status: "PUBLISHED" },
      })
    ).id;
    const subject = await prisma.subject.create({
      data: { courseId, title: "S", slug: "s", status: "PUBLISHED" },
    });
    const topic = await prisma.topic.create({
      data: { subjectId: subject.id, title: "T", slug: "t", status: "PUBLISHED" },
    });
    const mod = await prisma.module.create({
      data: { topicId: topic.id, title: "M", slug: "m", status: "PUBLISHED" },
    });
    const lessons = await Promise.all(
      [0, 1].map((i) =>
        prisma.lesson.create({
          data: { moduleId: mod.id, title: `L${i}`, slug: `l${i}`, status: "PUBLISHED" },
        }),
      ),
    );
    await prisma.lessonProgress.create({
      data: { userId: mine, lessonId: lessons[0]!.id, courseId, completedAt: new Date() },
    });
    const assignment = await prisma.assignment.create({
      data: {
        subjectId: subject.id,
        title: "A",
        slug: `mc-a-${suffix}`,
        brief: "b",
        fileRules: {},
        marksTotal: 10,
        status: "PUBLISHED",
      },
    });
    await prisma.assignmentSubmission.createMany({
      data: [
        { assignmentId: assignment.id, studentId: mine, version: 1, status: "REVISION_REQUESTED" },
        { assignmentId: assignment.id, studentId: mine, version: 2, status: "SUBMITTED" },
      ],
    });

    for (const studentId of [mine, unassigned]) {
      await prisma.enrollment.create({
        data: { userId: studentId, courseId, status: "ACTIVE", source: "ADMIN_GRANT" },
      });
    }
    await prisma.mentorAssignment.createMany({
      data: [
        { mentorId, studentId: mine, assignedById: mentorId },
        { mentorId, studentId: unassigned, assignedById: mentorId, unassignedAt: new Date() },
      ],
    });
  });

  afterAll(async () => {
    await prisma.mentorAssignment.deleteMany({ where: { mentorId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.course.deleteMany({ where: { id: { in: [courseId, otherCourseId] } } });
    await moduleRef.close();
  });

  it("lists only courses current students are licensed for", async () => {
    const courses = await service.courses(mentorId);
    expect(courses).toEqual([{ id: courseId, title: "MC course", studentCount: 1 }]);
  });

  it("reports lessons and the latest assignment state for current students only", async () => {
    const p = await service.progress(mentorId, courseId);
    expect(p.course).toMatchObject({ lessonCount: 2, assignmentCount: 1 });
    expect(p.students.map((s) => s.studentId)).toEqual([mine]);
    expect(p.students[0]).toMatchObject({
      lessonsCompleted: 1,
      completionPercent: 50,
      assignments: { awaitingReview: 1, revisionRequested: 0, notStarted: 0 },
    });
    expect(p.assignments[0]).toMatchObject({ awaitingReview: 1 });
  });

  it("refuses a course none of their students hold", async () => {
    await expect(service.progress(mentorId, otherCourseId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
