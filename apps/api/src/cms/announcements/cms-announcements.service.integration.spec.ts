import { BadRequestException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { CmsVersioningService } from "../cms-versioning.service";
import { CmsSchedulingQueueService } from "../scheduling/cms-scheduling-queue.service";
import { CmsAnnouncementsService } from "./cms-announcements.service";

describe("CmsAnnouncementsService (integration)", () => {
  let service: CmsAnnouncementsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let authorId: string;
  const suffix = Date.now();
  const schedulingQueue = { schedule: jest.fn(), cancel: jest.fn() };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        CmsAnnouncementsService,
        CmsVersioningService,
        PrismaService,
        { provide: CmsSchedulingQueueService, useValue: schedulingQueue },
      ],
    }).compile();
    service = moduleRef.get(CmsAnnouncementsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const author = await prisma.user.create({
      data: { email: `cms-announcements-author-${suffix}@example.test`, status: "ACTIVE" },
    });
    authorId = author.id;
  });

  afterAll(async () => {
    await prisma.cmsContentVersion.deleteMany({ where: { createdById: authorId } });
    await prisma.cmsAnnouncement.deleteMany({ where: { createdById: authorId } });
    await prisma.user.deleteMany({ where: { id: authorId } });
    await moduleRef.close();
  });

  it("creates an announcement in DRAFT and only allows editing while DRAFT", async () => {
    const item = await service.create(authorId, { title: "Maintenance window", body: "A" });
    expect(item.status).toBe("DRAFT");

    await service.transition(authorId, item.id, "IN_REVIEW");
    await expect(service.update(authorId, item.id, { title: "Blocked" })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("gates scheduled unpublish to only PUBLISHED content and clears it on archive", async () => {
    const item = await service.create(authorId, { title: "Time-limited", body: "A" });
    await expect(service.scheduleUnpublish(authorId, item.id, new Date())).rejects.toThrow(
      BadRequestException,
    );

    await service.transition(authorId, item.id, "IN_REVIEW");
    await service.transition(authorId, item.id, "APPROVED");
    await service.transition(authorId, item.id, "PUBLISHED");

    const at = new Date(Date.now() + 60_000);
    const scheduled = await service.scheduleUnpublish(authorId, item.id, at);
    expect(scheduled.scheduledUnpublishAt).toEqual(at);
    expect(schedulingQueue.schedule).toHaveBeenCalledWith("ANNOUNCEMENT", item.id, "UNPUBLISH", at);

    const archived = await service.transition(authorId, item.id, "ARCHIVED");
    expect(archived.scheduledUnpublishAt).toBeNull();
    expect(schedulingQueue.cancel).toHaveBeenCalledWith("ANNOUNCEMENT", item.id, "UNPUBLISH");
  });

  it("restores a prior version as a new version", async () => {
    const item = await service.create(authorId, { title: "Original", body: "Original body" });
    await service.update(authorId, item.id, { title: "Edited", body: "Edited body" });

    const restored = await service.restoreVersion(authorId, item.id, 1);
    expect(restored.title).toBe("Original");
    expect(restored.version).toBe(3);
  });

  it("listPublished only returns PUBLISHED announcements", async () => {
    const item = await service.create(authorId, { title: "Publish flow", body: "A" });
    expect((await service.listPublished()).some((a) => a.id === item.id)).toBe(false);

    await service.transition(authorId, item.id, "IN_REVIEW");
    await service.transition(authorId, item.id, "APPROVED");
    await service.transition(authorId, item.id, "PUBLISHED");
    expect((await service.listPublished()).some((a) => a.id === item.id)).toBe(true);
  });
});
