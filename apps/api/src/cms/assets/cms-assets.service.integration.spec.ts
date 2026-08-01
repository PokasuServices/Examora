import { randomUUID } from "node:crypto";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { STORAGE_PORT } from "../../storage/storage.port";
import { CmsAssetScanQueueService } from "./cms-asset-scan-queue.service";
import { CmsAssetsService } from "./cms-assets.service";

describe("CmsAssetsService (integration)", () => {
  let service: CmsAssetsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let uploaderId: string;
  const suffix = Date.now();
  const scanQueue = { enqueue: jest.fn() };
  const storage = {
    createPresignedUploadUrl: jest
      .fn()
      .mockResolvedValue({ url: "https://upload.test", key: "cms/assets/fake" }),
    createPresignedDownloadUrl: jest.fn().mockResolvedValue("https://download.test"),
    getObjectBuffer: jest.fn(),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        CmsAssetsService,
        PrismaService,
        { provide: STORAGE_PORT, useValue: storage },
        { provide: CmsAssetScanQueueService, useValue: scanQueue },
      ],
    }).compile();
    service = moduleRef.get(CmsAssetsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const uploader = await prisma.user.create({
      data: { email: `cms-assets-uploader-${suffix}@example.test`, status: "ACTIVE" },
    });
    uploaderId = uploader.id;
  });

  afterAll(async () => {
    await prisma.cmsAssetUsage.deleteMany({ where: { asset: { uploadedById: uploaderId } } });
    await prisma.cmsAsset.deleteMany({ where: { uploadedById: uploaderId } });
    await prisma.user.deleteMany({ where: { id: uploaderId } });
    await moduleRef.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a disallowed mime type at presign time", async () => {
    await expect(
      service.createPresignedUpload({
        fileName: "malware.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: 100,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects a file over the size limit", async () => {
    await expect(
      service.createPresignedUpload({
        fileName: "huge.png",
        mimeType: "image/png",
        sizeBytes: 20 * 1024 * 1024,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("confirmUpload creates a PENDING asset and enqueues the malware scan", async () => {
    const asset = await service.confirmUpload(uploaderId, {
      storageKey: `cms/assets/${suffix}-confirm.png`,
      fileName: "confirm.png",
      mimeType: "image/png",
      sizeBytes: 100,
    });
    expect(asset.scanStatus).toBe("PENDING");
    expect(scanQueue.enqueue).toHaveBeenCalledWith(asset.id);
  });

  it("getDownloadUrl only resolves for a CLEAN asset", async () => {
    const asset = await service.confirmUpload(uploaderId, {
      storageKey: `cms/assets/${suffix}-pending.png`,
      fileName: "pending.png",
      mimeType: "image/png",
      sizeBytes: 100,
    });
    await expect(service.getDownloadUrl(asset.id)).rejects.toThrow(NotFoundException);

    await prisma.cmsAsset.update({ where: { id: asset.id }, data: { scanStatus: "CLEAN" } });
    await expect(service.getDownloadUrl(asset.id)).resolves.toBe("https://download.test");
  });

  it("blocks deleting an asset that is still referenced by content, allows it once unreferenced", async () => {
    const asset = await service.confirmUpload(uploaderId, {
      storageKey: `cms/assets/${suffix}-referenced.png`,
      fileName: "referenced.png",
      mimeType: "image/png",
      sizeBytes: 100,
    });
    const contentId = randomUUID();
    await service.recordUsage(asset.id, "BANNER", contentId);

    await expect(service.remove(asset.id)).rejects.toThrow(BadRequestException);

    await service.removeUsage(asset.id, "BANNER", contentId);
    await expect(service.remove(asset.id)).resolves.toBeUndefined();
    expect(storage.deleteObject).toHaveBeenCalledWith(asset.storageKey);
  });

  it("recordUsage is idempotent and removeUsage on a non-existent usage does not throw", async () => {
    const asset = await service.confirmUpload(uploaderId, {
      storageKey: `cms/assets/${suffix}-idempotent.png`,
      fileName: "idempotent.png",
      mimeType: "image/png",
      sizeBytes: 100,
    });
    const contentId = randomUUID();
    await service.recordUsage(asset.id, "BANNER", contentId);
    await service.recordUsage(asset.id, "BANNER", contentId);
    expect(await prisma.cmsAssetUsage.count({ where: { assetId: asset.id, contentId } })).toBe(1);

    await expect(service.removeUsage(asset.id, "PAGE", randomUUID())).resolves.toBeUndefined();
  });

  it("list() includes usage counts and the uploader's email", async () => {
    const { items } = await service.list({ page: 1, pageSize: 100 });
    const mine = items.filter(
      (a) => a.uploadedBy.email === `cms-assets-uploader-${suffix}@example.test`,
    );
    expect(mine.length).toBeGreaterThan(0);
    expect(mine[0]!._count.usages).toBeDefined();
  });
});
