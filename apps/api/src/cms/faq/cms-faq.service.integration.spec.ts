import { BadRequestException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { CmsVersioningService } from "../cms-versioning.service";
import { CmsSchedulingQueueService } from "../scheduling/cms-scheduling-queue.service";
import { CmsFaqService } from "./cms-faq.service";

describe("CmsFaqService (integration)", () => {
  let service: CmsFaqService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let authorId: string;
  const suffix = Date.now();
  const schedulingQueue = { schedule: jest.fn(), cancel: jest.fn() };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        CmsFaqService,
        CmsVersioningService,
        PrismaService,
        { provide: CmsSchedulingQueueService, useValue: schedulingQueue },
      ],
    }).compile();
    service = moduleRef.get(CmsFaqService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const author = await prisma.user.create({
      data: { email: `cms-faq-author-${suffix}@example.test`, status: "ACTIVE" },
    });
    authorId = author.id;
  });

  afterAll(async () => {
    await prisma.cmsContentVersion.deleteMany({ where: { createdById: authorId } });
    await prisma.cmsFaqItem.deleteMany({ where: { createdById: authorId } });
    await prisma.user.deleteMany({ where: { id: authorId } });
    await moduleRef.close();
  });

  it("creates a FAQ item in DRAFT and only allows editing while DRAFT", async () => {
    const item = await service.create(authorId, { question: "Q1?", answer: "A1" });
    expect(item.status).toBe("DRAFT");
    expect(item.version).toBe(1);

    await service.transition(authorId, item.id, "IN_REVIEW");
    await expect(service.update(authorId, item.id, { answer: "Blocked" })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("walks the lifecycle to PUBLISHED and back to ARCHIVED, bumping version each time", async () => {
    const item = await service.create(authorId, { question: "Q2?", answer: "A2" });
    await service.transition(authorId, item.id, "IN_REVIEW");
    await service.transition(authorId, item.id, "APPROVED");
    const published = await service.transition(authorId, item.id, "PUBLISHED");
    expect(published.publishedAt).not.toBeNull();
    expect(published.version).toBe(4);

    const listed = await service.listPublished();
    expect(listed.some((i) => i.id === item.id)).toBe(true);

    await service.transition(authorId, item.id, "ARCHIVED");
    expect((await service.listPublished()).some((i) => i.id === item.id)).toBe(false);
  });

  it("restores a prior version as a new version", async () => {
    const item = await service.create(authorId, {
      question: "Original?",
      answer: "Original answer",
    });
    await service.update(authorId, item.id, { question: "Edited?", answer: "Edited answer" });

    const restored = await service.restoreVersion(authorId, item.id, 1);
    expect(restored.question).toBe("Original?");
    expect(restored.version).toBe(3);
  });

  it("list() orders by position ascending", async () => {
    const base = suffix;
    await service.create(authorId, { question: `Pos-${base}-B`, answer: "b", position: 2 });
    await service.create(authorId, { question: `Pos-${base}-A`, answer: "a", position: 1 });

    const { items } = await service.list({ page: 1, pageSize: 50 });
    const relevant = items.filter((i) => i.question.startsWith(`Pos-${base}`));
    expect(relevant.map((i) => i.question)).toEqual([`Pos-${base}-A`, `Pos-${base}-B`]);
  });
});
