import { BadRequestException, ConflictException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { DailyQuizService, todayInIndia, XP_PER_CORRECT } from "./daily-quiz.service";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Catch-up: missed days in the last week, half XP, never on leaderboards or streaks. */
describe("DailyQuizService catch-up (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let daily: DailyQuizService;
  let xp: XpService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let userId: string;
  let courseId: string;
  const questionIds: string[] = [];
  let createdQuizId: string | null = null;
  const missed = new Date(todayInIndia().getTime() - 2 * DAY);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [DailyQuizService, XpService, PrismaService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    daily = moduleRef.get(DailyQuizService);
    xp = moduleRef.get(XpService);
    await prisma.$connect();

    // Joined a week ago, so the missed day counts as missed (not "before you joined").
    userId = (
      await prisma.user.create({
        data: {
          email: `daily-${suffix}@example.test`,
          status: "ACTIVE",
          createdAt: new Date(Date.now() - 7 * DAY),
        },
      })
    ).id;
    courseId = (
      await prisma.course.create({
        data: { title: "Daily", slug: `daily-${suffix}`, status: "PUBLISHED" },
      })
    ).id;
    const subject = await prisma.subject.create({
      data: { courseId, title: "GK", slug: "gk", status: "PUBLISHED" },
    });
    for (let i = 0; i < 3; i++) {
      const q = await prisma.question.create({
        data: {
          subjectId: subject.id,
          type: "SINGLE_CHOICE",
          text: `Daily ${i}`,
          status: "PUBLISHED",
          options: {
            create: [
              { text: "Right", isCorrect: true, position: 0 },
              { text: "Wrong", isCorrect: false, position: 1 },
            ],
          },
        },
      });
      questionIds.push(q.id);
    }
    // Use our own quiz for the missed day unless the shared dev database already has one.
    const existing = await prisma.dailyQuiz.findUnique({
      where: { date_scope: { date: missed, scope: "" } },
    });
    if (!existing) {
      createdQuizId = (await prisma.dailyQuiz.create({ data: { date: missed, questionIds } })).id;
    }
  });

  afterAll(async () => {
    await prisma.dailyQuizAttempt.deleteMany({ where: { userId } });
    if (createdQuizId) await prisma.dailyQuiz.deleteMany({ where: { id: createdQuizId } });
    await prisma.xpEvent.deleteMany({ where: { userId } });
    await prisma.question.deleteMany({ where: { id: { in: questionIds } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await moduleRef.close();
  });

  it("only allows the last 7 days, never the future", async () => {
    const tooOld = iso(new Date(todayInIndia().getTime() - 8 * DAY));
    const tomorrow = iso(new Date(todayInIndia().getTime() + DAY));
    await expect(daily.start(userId, tooOld)).rejects.toBeInstanceOf(BadRequestException);
    await expect(daily.start(userId, tomorrow)).rejects.toBeInstanceOf(BadRequestException);
    await expect(daily.start(userId, "20-11-2026")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("shows the missed day as catchable, then plays it for half XP off the leaderboard", async () => {
    const before = await daily.dashboard(userId);
    const dayBefore = before.calendar.find((d) => d.date === iso(missed));
    expect(dayBefore).toMatchObject({ status: "missed", canCatchUp: true });

    const xpBefore = await xp.getTotal(userId);
    const questions = await daily.start(userId, iso(missed));
    // Answer the first option everywhere (right for our questions).
    const result = await daily.finish(
      userId,
      questions.map((q) => ({ questionId: q.questionId, optionId: q.options[0]!.id, ms: 500 })),
      iso(missed),
    );
    expect(result.catchUp).toBe(true);
    expect(result.date).toBe(iso(missed));
    expect(result.xpAwarded).toBe(Math.floor((result.correctCount * XP_PER_CORRECT) / 2));
    expect(await xp.getTotal(userId)).toBe(xpBefore + result.xpAwarded);
    expect(result.leaderboard.some((r) => r.isMe)).toBe(false);
    await expect(daily.start(userId, iso(missed))).rejects.toBeInstanceOf(ConflictException);

    const after = await daily.dashboard(userId);
    expect(after.calendar.find((d) => d.date === iso(missed))).toMatchObject({
      status: "catch-up",
      canCatchUp: false,
    });
    // Catch-ups count as days played, never as a streak.
    expect(after.stats.daysPlayed).toBe(1);
    expect(after.stats.currentStreak).toBe(0);
    expect(after.awards.map((a) => a.key)).toContain("week-perfect");
  });
});
