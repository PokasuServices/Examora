import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { RecommendationFeatureFlagsService } from "./recommendation-feature-flags.service";

describe("RecommendationFeatureFlagsService (integration)", () => {
  let service: RecommendationFeatureFlagsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let adminId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [RecommendationFeatureFlagsService, PrismaService],
    }).compile();
    service = moduleRef.get(RecommendationFeatureFlagsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const admin = await prisma.user.create({
      data: { email: `flag-admin-${suffix}@example.test`, status: "ACTIVE" },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    await prisma.recommendationFeatureFlag.deleteMany({ where: { updatedById: adminId } });
    await prisma.user.deleteMany({ where: { id: adminId } });
    await moduleRef.close();
  });

  it("defaults every type to enabled with no row present", async () => {
    expect(await service.isEnabled("COURSE")).toBe(true);
    const all = await service.listAll();
    expect(all.every((f) => f.isEnabled)).toBe(true);
    expect(all).toHaveLength(7);
  });

  it("disabling a type persists and is reflected by isEnabled", async () => {
    await service.setEnabled("COMMUNITY_DISCUSSION", false, adminId);
    expect(await service.isEnabled("COMMUNITY_DISCUSSION")).toBe(false);
    const all = await service.listAll();
    const flag = all.find((f) => f.type === "COMMUNITY_DISCUSSION");
    expect(flag!.isEnabled).toBe(false);
    expect(flag!.updatedByEmail).toBe(`flag-admin-${suffix}@example.test`);
  });

  it("re-enabling a previously-disabled type flips it back", async () => {
    await service.setEnabled("COMMUNITY_DISCUSSION", true, adminId);
    expect(await service.isEnabled("COMMUNITY_DISCUSSION")).toBe(true);
  });
});
