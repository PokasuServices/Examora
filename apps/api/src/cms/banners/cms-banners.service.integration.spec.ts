import { BadRequestException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { STORAGE_PORT } from "../../storage/storage.port";
import { CmsAssetScanQueueService } from "../assets/cms-asset-scan-queue.service";
import { CmsAssetsService } from "../assets/cms-assets.service";
import { CmsVersioningService } from "../cms-versioning.service";
import { CmsSchedulingQueueService } from "../scheduling/cms-scheduling-queue.service";
import { CmsBannersService } from "./cms-banners.service";

describe("CmsBannersService (integration)", () => {
  let service: CmsBannersService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let authorId: string;
  let assetOneId: string;
  let assetTwoId: string;
  const suffix = Date.now();
  const schedulingQueue = { schedule: jest.fn(), cancel: jest.fn() };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        CmsBannersService,
        CmsVersioningService,
        CmsAssetsService,
        PrismaService,
        { provide: CmsSchedulingQueueService, useValue: schedulingQueue },
        { provide: STORAGE_PORT, useValue: {} },
        { provide: CmsAssetScanQueueService, useValue: { enqueue: async () => undefined } },
      ],
    }).compile();
    service = moduleRef.get(CmsBannersService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const author = await prisma.user.create({
      data: { email: `cms-banners-author-${suffix}@example.test`, status: "ACTIVE" },
    });
    authorId = author.id;

    const [assetOne, assetTwo] = await Promise.all([
      prisma.cmsAsset.create({
        data: {
          fileName: "one.png",
          mimeType: "image/png",
          sizeBytes: 100,
          storageKey: `cms/assets/${suffix}-one.png`,
          uploadedById: authorId,
        },
      }),
      prisma.cmsAsset.create({
        data: {
          fileName: "two.png",
          mimeType: "image/png",
          sizeBytes: 100,
          storageKey: `cms/assets/${suffix}-two.png`,
          uploadedById: authorId,
        },
      }),
    ]);
    assetOneId = assetOne.id;
    assetTwoId = assetTwo.id;
  });

  afterAll(async () => {
    await prisma.cmsContentVersion.deleteMany({ where: { createdById: authorId } });
    await prisma.cmsAssetUsage.deleteMany({ where: { assetId: { in: [assetOneId, assetTwoId] } } });
    await prisma.cmsBanner.deleteMany({ where: { createdById: authorId } });
    await prisma.cmsAsset.deleteMany({ where: { uploadedById: authorId } });
    await prisma.user.deleteMany({ where: { id: authorId } });
    await moduleRef.close();
  });

  it("only allows editing while in DRAFT", async () => {
    const banner = await service.create(authorId, { title: "Sale", placement: "HOMEPAGE_TOP" });
    await service.transition(authorId, banner.id, "IN_REVIEW");
    await expect(service.update(authorId, banner.id, { title: "Blocked" })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("records asset usage on create and removes it when the image is swapped or cleared", async () => {
    const banner = await service.create(authorId, {
      title: "Promo",
      placement: "HOMEPAGE_TOP",
      imageAssetId: assetOneId,
    });
    expect(
      await prisma.cmsAssetUsage.count({ where: { assetId: assetOneId, contentId: banner.id } }),
    ).toBe(1);

    await service.update(authorId, banner.id, { imageAssetId: assetTwoId });
    expect(
      await prisma.cmsAssetUsage.count({ where: { assetId: assetOneId, contentId: banner.id } }),
    ).toBe(0);
    expect(
      await prisma.cmsAssetUsage.count({ where: { assetId: assetTwoId, contentId: banner.id } }),
    ).toBe(1);

    await service.update(authorId, banner.id, { imageAssetId: undefined });
    // imageAssetId omitted from the DTO means "leave unchanged" for a partial
    // update, so usage should still point at assetTwo.
    expect(
      await prisma.cmsAssetUsage.count({ where: { assetId: assetTwoId, contentId: banner.id } }),
    ).toBe(1);

    const cleared = await service.update(authorId, banner.id, { imageAssetId: null });
    expect(cleared.imageAssetId).toBeNull();
    expect(
      await prisma.cmsAssetUsage.count({ where: { assetId: assetTwoId, contentId: banner.id } }),
    ).toBe(0);
  });

  it("re-records asset usage when a version is restored", async () => {
    const banner = await service.create(authorId, {
      title: "Restore Me",
      placement: "SIDEBAR",
      imageAssetId: assetOneId,
    });
    await service.update(authorId, banner.id, { imageAssetId: assetTwoId });
    expect(
      await prisma.cmsAssetUsage.count({ where: { assetId: assetOneId, contentId: banner.id } }),
    ).toBe(0);

    const restored = await service.restoreVersion(authorId, banner.id, 1);
    expect(restored.imageAssetId).toBe(assetOneId);
    expect(
      await prisma.cmsAssetUsage.count({ where: { assetId: assetOneId, contentId: banner.id } }),
    ).toBe(1);
    expect(
      await prisma.cmsAssetUsage.count({ where: { assetId: assetTwoId, contentId: banner.id } }),
    ).toBe(0);
  });

  it("list() filters by placement", async () => {
    await service.create(authorId, { title: "Filtered", placement: `SIDEBAR-${suffix}` });
    const { items } = await service.list({ page: 1, pageSize: 50, placement: `SIDEBAR-${suffix}` });
    expect(items.every((b) => b.placement === `SIDEBAR-${suffix}`)).toBe(true);
    expect(items).toHaveLength(1);
  });
});
