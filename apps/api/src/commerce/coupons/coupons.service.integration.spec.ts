import { BadRequestException, ConflictException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { CouponsService } from "./coupons.service";

describe("CouponsService (integration)", () => {
  let service: CouponsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let actorId: string;
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [CouponsService, PrismaService],
    }).compile();
    service = moduleRef.get(CouponsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const actor = await prisma.user.create({
      data: { email: `coupon-admin-${suffix}@example.test`, status: "ACTIVE" },
    });
    actorId = actor.id;
  });

  afterAll(async () => {
    await prisma.coupon.deleteMany({ where: { createdById: actorId } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await moduleRef.close();
  });

  it("creates a percentage coupon and rejects a duplicate code", async () => {
    const coupon = await service.create(
      { code: `SAVE10-${suffix}`, discountType: "PERCENTAGE", discountValue: 10 },
      actorId,
    );
    expect(coupon.discountType).toBe("PERCENTAGE");

    await expect(
      service.create(
        { code: `SAVE10-${suffix}`, discountType: "PERCENTAGE", discountValue: 10 },
        actorId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a percentage discount over 100", async () => {
    await expect(
      service.create(
        { code: `OVER100-${suffix}`, discountType: "PERCENTAGE", discountValue: 150 },
        actorId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("validateForCheckout computes a percentage discount capped at the subtotal", async () => {
    const coupon = await service.create(
      { code: `HALF-${suffix}`, discountType: "PERCENTAGE", discountValue: 50 },
      actorId,
    );
    const result = await service.validateForCheckout(coupon.code, 1000);
    expect(result.discountAmount).toBe(500);
  });

  it("validateForCheckout computes a fixed discount capped at the subtotal", async () => {
    const coupon = await service.create(
      { code: `FLAT2000-${suffix}`, discountType: "FIXED", discountValue: 2000 },
      actorId,
    );
    const result = await service.validateForCheckout(coupon.code, 999);
    expect(result.discountAmount).toBe(999);
  });

  it("rejects an unknown coupon code", async () => {
    await expect(service.validateForCheckout(`NOPE-${suffix}`, 100)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects an expired coupon", async () => {
    const coupon = await service.create(
      {
        code: `EXPIRED-${suffix}`,
        discountType: "FIXED",
        discountValue: 100,
        validUntil: new Date(Date.now() - 86_400_000).toISOString(),
      },
      actorId,
    );
    await expect(service.validateForCheckout(coupon.code, 500)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects a fully-redeemed coupon and recordRedemption enforces the limit", async () => {
    const coupon = await service.create(
      { code: `ONCE-${suffix}`, discountType: "FIXED", discountValue: 50, maxRedemptions: 1 },
      actorId,
    );
    await service.recordRedemption(coupon.id);
    await expect(service.validateForCheckout(coupon.code, 500)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("update can deactivate a coupon, which then fails validation", async () => {
    const coupon = await service.create(
      { code: `TOGGLE-${suffix}`, discountType: "FIXED", discountValue: 50 },
      actorId,
    );
    await service.update(coupon.id, { isActive: false });
    await expect(service.validateForCheckout(coupon.code, 500)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
