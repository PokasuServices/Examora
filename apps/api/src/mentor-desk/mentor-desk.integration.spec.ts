import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { SketchesService } from "../sketches/sketches.service";
import { StaffScopeService } from "../staff/staff-scope.service";
import { AttendanceService } from "./attendance.service";
import { DeskNotifier } from "./desk-notifier.service";
import { addDays, isoDay, todayIndia } from "./desk-util";
import { ExcelService } from "./excel.service";
import { QuizToolsService, similarity } from "./quiz-tools.service";

/**
 * Mentor module core rules against the real database: scoping by batch
 * (including an expired cover), attendance percentages, and the daily quiz
 * calendar's one-per-course-per-day rule.
 */
describe("Mentor desk (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let scope: StaffScopeService;
  let attendance: AttendanceService;
  let tools: QuizToolsService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let mentorId: string;
  let otherMentorId: string;
  let courseId: string;
  let otherCourseId: string;
  let cohortId: string;
  let otherCohortId: string;
  let expiredCoverCohortId: string;
  const studentIds: string[] = [];
  const questionIds: string[] = [];

  const actor = () => ({
    id: mentorId,
    email: `m-${suffix}@example.test`,
    roles: ["MENTOR" as const],
  });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        StaffScopeService,
        AttendanceService,
        ExcelService,
        QuizToolsService,
        {
          provide: DeskNotifier,
          useValue: { user: async () => undefined, admins: async () => undefined },
        },
        { provide: SketchesService, useValue: {} },
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    scope = moduleRef.get(StaffScopeService);
    attendance = moduleRef.get(AttendanceService);
    tools = moduleRef.get(QuizToolsService);
    await prisma.$connect();

    const mk = (email: string) =>
      prisma.user.create({ data: { email, status: "ACTIVE" } }).then((u) => u.id);
    mentorId = await mk(`md-m-${suffix}@example.test`);
    otherMentorId = await mk(`md-o-${suffix}@example.test`);
    for (let i = 0; i < 3; i++) studentIds.push(await mk(`md-s${i}-${suffix}@example.test`));
    courseId = (
      await prisma.course.create({ data: { title: `MD course ${suffix}`, slug: `md-${suffix}` } })
    ).id;
    otherCourseId = (
      await prisma.course.create({ data: { title: `MD other ${suffix}`, slug: `md-o-${suffix}` } })
    ).id;
    const subjectId = (
      await prisma.subject.create({
        data: { courseId, title: "Maths", slug: `maths-${suffix}`, status: "PUBLISHED" },
      })
    ).id;
    for (let i = 0; i < 6; i++) {
      const q = await prisma.question.create({
        data: {
          subjectId,
          type: "SINGLE_CHOICE",
          text: `Mentor desk question ${i} about the colour wheel ${suffix}`,
          status: "PUBLISHED",
          options: {
            create: [
              { text: "A", isCorrect: true, position: 0 },
              { text: "B", position: 1 },
            ],
          },
        },
      });
      questionIds.push(q.id);
    }
    const today = todayIndia();
    cohortId = (
      await prisma.cohort.create({
        data: {
          name: `MD batch ${suffix}`,
          courseId,
          schedule: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: "18:00", end: "19:00" })),
          startsOn: addDays(today, -10),
        },
      })
    ).id;
    otherCohortId = (
      await prisma.cohort.create({ data: { name: `MD other ${suffix}`, courseId: otherCourseId } })
    ).id;
    expiredCoverCohortId = (
      await prisma.cohort.create({
        data: { name: `MD expired ${suffix}`, courseId: otherCourseId },
      })
    ).id;
    await prisma.cohortMentor.createMany({
      data: [
        { cohortId, mentorId, role: "PRIMARY" },
        { cohortId: otherCohortId, mentorId: otherMentorId, role: "PRIMARY" },
        { cohortId: expiredCoverCohortId, mentorId, role: "COVER", endsOn: addDays(today, -1) },
      ],
    });
    await prisma.cohortMember.createMany({
      data: [
        ...studentIds.slice(0, 2).map((userId) => ({ cohortId, userId })),
        { cohortId: otherCohortId, userId: studentIds[2]! },
      ],
    });
  });

  afterAll(async () => {
    await prisma.dailyQuizSchedule.deleteMany({ where: { courseId } });
    await prisma.cohort.deleteMany({
      where: { id: { in: [cohortId, otherCohortId, expiredCoverCohortId] } },
    });
    await prisma.question.deleteMany({ where: { id: { in: questionIds } } });
    await prisma.course.deleteMany({ where: { id: { in: [courseId, otherCourseId] } } });
    await prisma.user.deleteMany({
      where: { id: { in: [mentorId, otherMentorId, ...studentIds] } },
    });
    await moduleRef.close();
  });

  it("scopes a mentor to their own batches; an expired cover gives no access", async () => {
    const s = await scope.mentorScope(mentorId);
    expect(s.cohortIds).toEqual([cohortId]);
    expect(s.courseIds).toEqual([courseId]);
    expect(s.studentIds.sort()).toEqual(studentIds.slice(0, 2).sort());
    expect(await scope.allows(s, "course", otherCourseId)).toBe(false);
    expect(await scope.allows(s, "cohort", otherCohortId)).toBe(false);
    expect(await scope.allows(s, "question", questionIds[0]!)).toBe(true);
    expect(await scope.allows(s, "student", studentIds[2]!)).toBe(false);
    await expect(scope.assert(actor(), "cohort", otherCohortId)).rejects.toThrow("Not found");
    // Administrators are never scoped.
    expect(await scope.scopeFor({ id: mentorId, roles: ["MENTOR", "ADMINISTRATOR"] })).toBeNull();
  });

  it("creates classes from the timetable and counts late as attended, excused as not held", async () => {
    scope.invalidate();
    const today = todayIndia();
    const sessions = await attendance.listSessions(await scope.mentorScope(mentorId), {
      cohortId,
      from: isoDay(addDays(today, -3)),
      to: isoDay(addDays(today, -1)),
    });
    expect(sessions).toHaveLength(3);
    const [a, b, c] = studentIds;
    const marks: [string, ("PRESENT" | "LATE" | "ABSENT" | "EXCUSED")[]][] = [
      [a!, ["PRESENT", "LATE", "ABSENT"]],
      [b!, ["EXCUSED", "PRESENT", "PRESENT"]],
    ];
    for (const [i, s] of sessions.entries()) {
      await attendance.mark(actor(), s.id, {
        records: marks.map(([userId, st]) => ({ userId, status: st[i]! })),
      });
    }
    const grid = await attendance.grid(cohortId, addDays(today, -3), addDays(today, -1));
    const rowA = grid.rows.find((r) => r.userId === a)!;
    const rowB = grid.rows.find((r) => r.userId === b)!;
    expect(rowA.percent).toBe(67); // 2 of 3
    expect(rowB.percent).toBe(100); // excused class not counted
    // A student from another batch can't be marked here.
    await expect(
      attendance.mark(actor(), sessions[0]!.id, { records: [{ userId: c!, status: "PRESENT" }] }),
    ).rejects.toThrow("isn't in this batch");
  });

  it("keeps one daily quiz per course per day: a clash moves to the next free day", async () => {
    const tomorrow = isoDay(addDays(todayIndia(), 1));
    const first = await tools.schedule(actor(), {
      courseId,
      date: tomorrow,
      title: "First",
      questionIds: questionIds.slice(0, 5),
    });
    expect(first.date).toBe(tomorrow);
    expect(first.movedFrom).toBeUndefined();
    const second = await tools.schedule(actor(), {
      courseId,
      date: tomorrow,
      title: "Second",
      questionIds: questionIds.slice(1, 6),
    });
    expect(second.date).toBe(isoDay(addDays(todayIndia(), 2)));
    expect(second.movedFrom).toBe(tomorrow);
    await expect(
      tools.schedule(actor(), {
        courseId: otherCourseId,
        date: tomorrow,
        title: "Nope",
        questionIds: questionIds.slice(0, 5),
      }),
    ).rejects.toThrow("Not found");
    await expect(
      tools.schedule(actor(), {
        courseId,
        date: tomorrow,
        title: "Too short",
        questionIds: questionIds.slice(0, 3),
      }),
    ).rejects.toThrow("5–15 questions");
  });

  it("flags near-duplicate questions", async () => {
    expect(
      similarity(
        "Which colour is formed by mixing blue and yellow?",
        "Which colour is formed by mixing  blue & yellow",
      ),
    ).toBeGreaterThan(90);
    expect(
      similarity("How many faces does a cube have?", "Name the capital of France"),
    ).toBeLessThan(40);
    const s = await scope.mentorScope(mentorId);
    const matches = await tools.duplicates(s, {
      text: `Mentor desk question 3 about the colour wheel ${suffix}`,
      courseId,
    });
    expect(matches[0]?.questionId).toBe(questionIds[3]);
    expect(matches[0]?.similarity).toBe(100);
  });
});
