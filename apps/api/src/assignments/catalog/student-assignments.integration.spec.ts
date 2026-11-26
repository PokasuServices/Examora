import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { daysUntil, StudentAssignmentsService } from "./student-assignments.service";

const DAY = 86_400_000;

/** Assignments overview: states from the latest submission, deadlines, "new since last visit". */
describe("StudentAssignmentsService (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let service: StudentAssignmentsService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  let studentId: string;
  let reviewerId: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [StudentAssignmentsService, PrismaService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(StudentAssignmentsService);
    await prisma.$connect();

    studentId = (
      await prisma.user.create({ data: { email: `sa-s-${suffix}@example.test`, status: "ACTIVE" } })
    ).id;
    reviewerId = (
      await prisma.user.create({ data: { email: `sa-r-${suffix}@example.test`, status: "ACTIVE" } })
    ).id;
    const make = async (key: string, deadlineDays: number | null, publishedDaysAgo: number) => {
      ids[key] = (
        await prisma.assignment.create({
          data: {
            title: `SA ${key}`,
            slug: `sa-${key}-${suffix}`,
            brief: "b",
            fileRules: { allowedMimeTypes: ["image/png"], maxFileSizeMb: 5, maxFiles: 1 },
            marksTotal: "20",
            deadline: deadlineDays === null ? null : new Date(now.getTime() + deadlineDays * DAY),
            status: "PUBLISHED",
            publishedAt: new Date(now.getTime() - publishedDaysAgo * DAY),
          },
        })
      ).id;
    };
    await make("fresh", 10, 0); // new, not started
    await make("soon", 2, 20); // due in 2 days, draft
    await make("late", -3, 30); // overdue, not started
    await make("waiting", 5, 30); // submitted
    await make("changes", 4, 30); // revision requested
    await make("done", null, 30); // approved with marks

    const submit = async (key: string, status: string, version = 1) =>
      prisma.assignmentSubmission.create({
        data: {
          assignmentId: ids[key]!,
          studentId,
          version,
          status: status as "DRAFT",
          submittedAt: status === "DRAFT" ? null : now,
        },
      });
    await submit("soon", "DRAFT");
    await submit("waiting", "SUBMITTED");
    const changes = await submit("changes", "REVISION_REQUESTED");
    const done = await submit("done", "APPROVED");
    await prisma.assignmentReview.create({
      data: {
        submissionId: changes.id,
        reviewerId,
        status: "PUBLISHED",
        decision: "REVISION_REQUESTED",
        overallComment: "Redo the second panel",
      },
    });
    await prisma.assignmentReview.create({
      data: {
        submissionId: done.id,
        reviewerId,
        status: "PUBLISHED",
        decision: "APPROVED",
        obtainedMarks: "15",
        overallComment: "Lovely work",
      },
    });
  });

  afterAll(async () => {
    await prisma.assignment.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await prisma.user.deleteMany({ where: { id: { in: [studentId, reviewerId] } } });
    await moduleRef.close();
  });

  const mine = (d: Awaited<ReturnType<StudentAssignmentsService["dashboard"]>>, key: string) =>
    d.items.find((i) => i.id === ids[key])!;

  it("works out each assignment's state, deadline and result", async () => {
    const d = await service.dashboard(studentId, now);
    expect(mine(d, "fresh")).toMatchObject({ state: "NOT_STARTED", isNew: true, overdue: false });
    expect(mine(d, "soon")).toMatchObject({ state: "DRAFT", dueInDays: 2, overdue: false });
    expect(mine(d, "late")).toMatchObject({ state: "NOT_STARTED", overdue: true, dueInDays: -3 });
    expect(mine(d, "waiting").state).toBe("WAITING");
    expect(mine(d, "changes")).toMatchObject({
      state: "NEEDS_CHANGES",
      reviewerNote: "Redo the second panel",
    });
    expect(mine(d, "done")).toMatchObject({
      state: "REVIEWED",
      obtainedMarks: 15,
      reviewerNote: "Lovely work",
    });
    // Our six assignments are among the totals (the shared dev DB may hold more).
    expect(d.counts.needsChanges).toBeGreaterThanOrEqual(1);
    expect(d.counts.dueSoon).toBeGreaterThanOrEqual(1);
    expect(d.counts.overdue).toBeGreaterThanOrEqual(1);
    // Things needing action come first.
    expect(d.items[0]!.state).toBe("NEEDS_CHANGES");
  });

  it("stops flagging assignments as new once the student has looked", async () => {
    await service.markSeen(studentId, new Date(now.getTime() + 1000));
    const d = await service.dashboard(studentId, now);
    expect(mine(d, "fresh").isNew).toBe(false);
    expect(d.lastSeenAt).not.toBeNull();
  });

  it("counts days to a deadline in whole days, negative once it has passed", () => {
    expect(daysUntil(new Date(now.getTime() + 1.2 * DAY), now)).toBe(2);
    expect(daysUntil(new Date(now.getTime() + 2 * 3_600_000), now)).toBe(1);
    expect(daysUntil(new Date(now.getTime() - 1.5 * DAY), now)).toBe(-2);
  });
});
