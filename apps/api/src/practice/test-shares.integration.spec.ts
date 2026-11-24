import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { SHARE_MAX_REWARDED, SHARE_XP_PER_VISITOR, TestSharesService } from "./test-shares.service";

/** Sharing a test: stable link, XP once per different visitor, capped, none for self-visits. */
describe("TestSharesService (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let shares: TestSharesService;
  let xp: XpService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userIds: string[] = [];
  let sharerId: string;
  let quizId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [TestSharesService, XpService, PrismaService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    shares = moduleRef.get(TestSharesService);
    xp = moduleRef.get(XpService);
    await prisma.$connect();
    for (let i = 0; i < SHARE_MAX_REWARDED + 2; i++) {
      const u = await prisma.user.create({
        data: { email: `share-${i}-${suffix}@example.test`, status: "ACTIVE" },
      });
      userIds.push(u.id);
    }
    sharerId = userIds[0]!;
    quizId = (
      await prisma.quiz.create({
        data: { title: "Shared", slug: `shared-${suffix}`, status: "PUBLISHED" },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.quiz.deleteMany({ where: { id: quizId } });
    await moduleRef.close();
  });

  it("gives each student one stable link", async () => {
    expect((await shares.get(sharerId, quizId)).code).toBeNull();
    const a = await shares.create(sharerId, quizId);
    const b = await shares.create(sharerId, quizId);
    expect(a.code).toBeTruthy();
    expect(b.code).toBe(a.code);
  });

  it("rewards the sharer once per different visitor, up to the cap", async () => {
    const { code } = await shares.get(sharerId, quizId);
    const before = await xp.getTotal(sharerId);

    expect((await shares.visit(sharerId, code!)).counted).toBe(false);
    expect((await shares.visit(userIds[1]!, code!)).counted).toBe(true);
    expect((await shares.visit(userIds[1]!, code!)).counted).toBe(false);
    for (const visitor of userIds.slice(2)) await shares.visit(visitor, code!);

    const info = await shares.get(sharerId, quizId);
    expect(info.visitors).toBe(userIds.length - 1);
    expect(info.xpEarned).toBe(SHARE_MAX_REWARDED * SHARE_XP_PER_VISITOR);
    expect(await xp.getTotal(sharerId)).toBe(before + SHARE_MAX_REWARDED * SHARE_XP_PER_VISITOR);
  });

  it("rejects unknown codes", async () => {
    await expect(shares.visit(userIds[1]!, "nope-nope-nope")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
