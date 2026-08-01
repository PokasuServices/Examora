import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { CmsVersioningService } from "../cms-versioning.service";
import { CmsSchedulingQueueService } from "../scheduling/cms-scheduling-queue.service";
import { CmsPagesService } from "./cms-pages.service";

describe("CmsPagesService (integration)", () => {
  let service: CmsPagesService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let authorId: string;
  const suffix = Date.now();
  const schedulingQueue = { schedule: jest.fn(), cancel: jest.fn() };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        CmsPagesService,
        CmsVersioningService,
        PrismaService,
        { provide: CmsSchedulingQueueService, useValue: schedulingQueue },
      ],
    }).compile();
    service = moduleRef.get(CmsPagesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const author = await prisma.user.create({
      data: { email: `cms-pages-author-${suffix}@example.test`, status: "ACTIVE" },
    });
    authorId = author.id;
  });

  afterAll(async () => {
    await prisma.cmsContentVersion.deleteMany({ where: { createdById: authorId } });
    await prisma.cmsPage.deleteMany({ where: { createdById: authorId } });
    await prisma.user.deleteMany({ where: { id: authorId } });
    await moduleRef.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("creates a page in DRAFT with version 1 and a matching history entry", async () => {
    const page = await service.create(authorId, {
      pageType: "LANDING",
      slug: `welcome-${suffix}`,
      title: "Welcome",
      body: "Hello world",
    });
    expect(page.status).toBe("DRAFT");
    expect(page.version).toBe(1);

    const versions = await service.listVersions(page.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.versionNumber).toBe(1);
    expect(versions[0]!.changeNote).toBe("Created");
  });

  it("rejects creating a second page with a duplicate slug", async () => {
    const slug = `dup-${suffix}`;
    await service.create(authorId, { pageType: "STATIC", slug, title: "First", body: "A" });
    await expect(
      service.create(authorId, { pageType: "STATIC", slug, title: "Second", body: "B" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("only allows editing while in DRAFT, and bumps the version on each edit", async () => {
    const page = await service.create(authorId, {
      pageType: "STATIC",
      slug: `editable-${suffix}`,
      title: "Original",
      body: "A",
    });
    const updated = await service.update(authorId, page.id, { title: "Revised" });
    expect(updated.title).toBe("Revised");
    expect(updated.version).toBe(2);

    await service.transition(authorId, page.id, "IN_REVIEW");
    await expect(service.update(authorId, page.id, { title: "Blocked" })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("walks the full Draft -> Review -> Approval -> Publish -> Archive lifecycle", async () => {
    const page = await service.create(authorId, {
      pageType: "LANDING",
      slug: `lifecycle-${suffix}`,
      title: "Lifecycle",
      body: "A",
    });

    const inReview = await service.transition(authorId, page.id, "IN_REVIEW");
    expect(inReview.status).toBe("IN_REVIEW");
    expect(inReview.version).toBe(2);

    const approved = await service.transition(authorId, page.id, "APPROVED");
    expect(approved.status).toBe("APPROVED");

    const published = await service.transition(authorId, page.id, "PUBLISHED");
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).not.toBeNull();

    const archived = await service.transition(authorId, page.id, "ARCHIVED");
    expect(archived.status).toBe("ARCHIVED");

    const versions = await service.listVersions(page.id);
    expect(versions).toHaveLength(5); // created + 4 transitions
  });

  it("rejects skipping states, e.g. DRAFT -> PUBLISHED", async () => {
    const page = await service.create(authorId, {
      pageType: "LANDING",
      slug: `skip-${suffix}`,
      title: "Skip",
      body: "A",
    });
    await expect(service.transition(authorId, page.id, "PUBLISHED")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("gates scheduling by current status and clears the schedule once the transition fires", async () => {
    const page = await service.create(authorId, {
      pageType: "LANDING",
      slug: `scheduled-${suffix}`,
      title: "Scheduled",
      body: "A",
    });
    await expect(service.schedulePublish(authorId, page.id, new Date())).rejects.toThrow(
      BadRequestException,
    );

    await service.transition(authorId, page.id, "IN_REVIEW");
    await service.transition(authorId, page.id, "APPROVED");

    const at = new Date(Date.now() + 60_000);
    const scheduled = await service.schedulePublish(authorId, page.id, at);
    expect(scheduled.scheduledPublishAt).toEqual(at);
    expect(schedulingQueue.schedule).toHaveBeenCalledWith("PAGE", page.id, "PUBLISH", at);

    const published = await service.transition(authorId, page.id, "PUBLISHED");
    expect(published.scheduledPublishAt).toBeNull();
    expect(schedulingQueue.cancel).toHaveBeenCalledWith("PAGE", page.id, "PUBLISH");
  });

  it("compares two versions and restores an earlier one as a new version", async () => {
    const page = await service.create(authorId, {
      pageType: "STATIC",
      slug: `restore-${suffix}`,
      title: "Version One",
      body: "Body one",
    });
    await service.update(authorId, page.id, { title: "Version Two", body: "Body two" });

    const diffs = await service.compareVersions(page.id, 1, 2);
    expect(diffs).toEqual(
      expect.arrayContaining([
        { field: "title", before: "Version One", after: "Version Two" },
        { field: "body", before: "Body one", after: "Body two" },
      ]),
    );

    const restored = await service.restoreVersion(authorId, page.id, 1);
    expect(restored.title).toBe("Version One");
    expect(restored.body).toBe("Body one");
    expect(restored.version).toBe(3);

    const versions = await service.listVersions(page.id);
    expect(versions[0]!.changeNote).toBe("Restored version 1");
  });

  it("findByIdOrThrow throws NotFoundException for a missing page", async () => {
    await expect(service.findByIdOrThrow(authorId)).rejects.toThrow(NotFoundException);
  });

  it("public reads only ever resolve PUBLISHED pages", async () => {
    const page = await service.create(authorId, {
      pageType: "LANDING",
      slug: `public-${suffix}`,
      title: "Public",
      body: "A",
    });
    await expect(service.findPublishedBySlugOrThrow(page.slug)).rejects.toThrow(NotFoundException);

    await service.transition(authorId, page.id, "IN_REVIEW");
    await service.transition(authorId, page.id, "APPROVED");
    await service.transition(authorId, page.id, "PUBLISHED");

    const found = await service.findPublishedBySlugOrThrow(page.slug);
    expect(found.id).toBe(page.id);

    const listed = await service.listPublished("LANDING");
    expect(listed.some((p) => p.id === page.id)).toBe(true);
  });

  it("list() filters by pageType and status", async () => {
    await service.create(authorId, {
      pageType: "STATIC",
      slug: `filter-${suffix}`,
      title: "Filter Me",
      body: "A",
    });
    const { items, total } = await service.list({
      page: 1,
      pageSize: 50,
      pageType: "STATIC",
      status: "DRAFT",
    });
    expect(total).toBeGreaterThan(0);
    expect(items.every((p) => p.pageType === "STATIC" && p.status === "DRAFT")).toBe(true);
  });
});
