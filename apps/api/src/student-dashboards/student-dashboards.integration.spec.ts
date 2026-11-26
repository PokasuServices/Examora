import { Test, type TestingModule } from "@nestjs/testing";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { StudentAlertsService } from "./student-alerts.service";
import { StudentDashboardsService } from "./student-dashboards.service";

const DAY = 86_400_000;

/** Tab summaries and pull-based bell alerts. */
describe("Student dashboards and alerts (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let dashboards: StudentDashboardsService;
  let alerts: StudentAlertsService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  let studentId: string;
  let otherId: string;
  const assignmentIds: string[] = [];
  let threadId: string;
  let boardId: string;
  let forumId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        StudentDashboardsService,
        StudentAlertsService,
        PrismaService,
        {
          // Stand-in for the real fan-out: just the in-app row, like IN_APP delivery.
          provide: NotificationsService,
          useFactory: (prisma: PrismaService) => ({
            enqueue: (p: {
              userId: string;
              eventType: string;
              category: string;
              title: string;
              body: string;
              data?: object;
            }) => prisma.notification.create({ data: { ...p, data: p.data ?? undefined } }),
          }),
          inject: [PrismaService],
        },
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    dashboards = moduleRef.get(StudentDashboardsService);
    alerts = moduleRef.get(StudentAlertsService);
    await prisma.$connect();

    studentId = (
      await prisma.user.create({
        data: {
          email: `sd-s-${suffix}@example.test`,
          firstName: "Mira",
          status: "ACTIVE",
          createdAt: new Date(now.getTime() - 30 * DAY),
        },
      })
    ).id;
    otherId = (
      await prisma.user.create({
        data: {
          email: `sd-o-${suffix}@example.test`,
          firstName: "Kabir",
          lastName: "R",
          status: "ACTIVE",
        },
      })
    ).id;

    // A new assignment (published yesterday) and one due in 10 hours.
    for (const [i, due] of [
      [0, 9 * DAY],
      [1, 10 * 3_600_000],
    ] as const) {
      assignmentIds.push(
        (
          await prisma.assignment.create({
            data: {
              title: `SD ${i}`,
              slug: `sd-${i}-${suffix}`,
              brief: "b",
              fileRules: { allowedMimeTypes: ["image/png"], maxFileSizeMb: 1, maxFiles: 1 },
              marksTotal: "10",
              status: "PUBLISHED",
              publishedAt: new Date(now.getTime() - (i === 0 ? DAY : 20 * DAY)),
              deadline: new Date(now.getTime() + due),
            },
          })
        ).id,
      );
    }

    // My forum thread with one reply from someone else, and a like on it.
    const forum = await prisma.forumCategory.create({
      data: { title: "SD", slug: `sd-${suffix}` },
    });
    forumId = forum.id;
    boardId = (
      await prisma.forumBoard.create({
        data: { categoryId: forum.id, title: "SD", slug: `sd-${suffix}` },
      })
    ).id;
    threadId = (
      await prisma.thread.create({
        data: { boardId, authorId: studentId, title: "How to shade cubes?", body: "Help" },
      })
    ).id;
    await prisma.reply.create({
      data: { threadId, authorId: otherId, body: "Start with the **light** source." },
    });
    await prisma.communityLike.create({
      data: { userId: otherId, targetType: "THREAD", targetId: threadId },
    });

    await prisma.xpEvent.createMany({
      data: [
        {
          userId: studentId,
          amount: 30,
          reason: "DAILY_QUIZ",
          sourceType: "DailyQuiz",
          sourceId: `a-${suffix}`,
        },
        {
          userId: studentId,
          amount: 10,
          reason: "LESSON_COMPLETED",
          sourceType: "Lesson",
          sourceId: `b-${suffix}`,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: [studentId, otherId] } } });
    await prisma.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
    await prisma.forumCategory.deleteMany({ where: { id: forumId } });
    await prisma.xpEvent.deleteMany({ where: { userId: studentId } });
    await prisma.user.deleteMany({ where: { id: { in: [studentId, otherId] } } });
    await moduleRef.close();
  });

  it("creates each bell alert once: new assignment and a deadline within 48 hours", async () => {
    const first = await alerts.sync(studentId, now);
    expect(first.created).toBeGreaterThanOrEqual(2);
    const mine = await prisma.notification.findMany({
      where: { userId: studentId, eventType: { startsWith: "student." } },
      select: { eventType: true, data: true, title: true },
    });
    const keys = mine.map((n) => (n.data as { alertKey: string }).alertKey);
    expect(keys).toContain(`assignment-new:${assignmentIds[0]}`);
    expect(keys).toContain(`assignment-due:${assignmentIds[1]}`);
    // The shared dev database may have other assignments due soon; pick ours by key.
    const due = mine.find(
      (n) => (n.data as { alertKey: string }).alertKey === `assignment-due:${assignmentIds[1]}`,
    );
    expect((due?.data as { url: string }).url).toBe(`/assignments/${assignmentIds[1]}`);

    // Syncing again creates nothing new.
    expect((await alerts.sync(studentId, now)).created).toBe(0);
  });

  it("summarises Discuss: replies and likes on my posts, new since my last visit", async () => {
    const d = await dashboards.discuss(studentId, now);
    expect(d.counts).toMatchObject({
      myThreads: 1,
      newReplies: 1,
      unanswered: 0,
      likesReceived: 1,
    });
    expect(d.latestReplies[0]).toMatchObject({
      threadId,
      threadTitle: "How to shade cubes?",
      authorName: "Kabir R.",
      excerpt: "Start with the light source.",
      isNew: true,
    });
    await dashboards.markSeen(studentId, "discuss", new Date(now.getTime() + 1000));
    expect((await dashboards.discuss(studentId, now)).counts.newReplies).toBe(0);
  });

  it("totals XP and shows where it came from", async () => {
    const r = await dashboards.rewards(studentId);
    expect(r.total).toBe(40);
    expect(r.thisWeek).toBe(40);
    expect(r.byReason.map((x) => [x.label, x.amount])).toEqual([
      ["Daily quiz", 30],
      ["Lesson completed", 10],
    ]);
  });

  it("shows an empty Colleges overview for a new student", async () => {
    const c = await dashboards.colleges(studentId, now);
    expect(c).toMatchObject({ shortlisted: [], myWebinars: [], enquiries: [] });
  });
});
