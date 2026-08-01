import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { CmsSearchService } from "./cms-search.service";

describe("CmsSearchService (integration)", () => {
  let service: CmsSearchService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let authorId: string;
  const suffix = Date.now();
  const keyword = `zephyr${suffix}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [CmsSearchService, PrismaService],
    }).compile();
    service = moduleRef.get(CmsSearchService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const author = await prisma.user.create({
      data: { email: `cms-search-author-${suffix}@example.test`, status: "ACTIVE" },
    });
    authorId = author.id;

    await prisma.cmsPage.create({
      data: {
        pageType: "LANDING",
        slug: `published-${suffix}`,
        title: `Published page about ${keyword}`,
        body: "irrelevant body",
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdById: authorId,
      },
    });
    await prisma.cmsPage.create({
      data: {
        pageType: "LANDING",
        slug: `draft-${suffix}`,
        title: `Draft page about ${keyword}`,
        body: "irrelevant body",
        status: "DRAFT",
        createdById: authorId,
      },
    });
    await prisma.cmsFaqItem.create({
      data: {
        question: `What is ${keyword}?`,
        answer: "It's a test keyword.",
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdById: authorId,
      },
    });
    await prisma.cmsAnnouncement.create({
      data: {
        title: `Announcing ${keyword}`,
        body: "irrelevant body",
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdById: authorId,
      },
    });
    await prisma.cmsBanner.create({
      data: {
        title: `Banner mentioning ${keyword}`,
        placement: "HOMEPAGE_TOP",
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdById: authorId,
      },
    });
  });

  afterAll(async () => {
    await prisma.cmsBanner.deleteMany({ where: { createdById: authorId } });
    await prisma.cmsAnnouncement.deleteMany({ where: { createdById: authorId } });
    await prisma.cmsFaqItem.deleteMany({ where: { createdById: authorId } });
    await prisma.cmsPage.deleteMany({ where: { createdById: authorId } });
    await prisma.user.deleteMany({ where: { id: authorId } });
    await moduleRef.close();
  });

  it("matches PUBLISHED pages, FAQ, and announcements, case-insensitively", async () => {
    const { items, total } = await service.search({
      q: keyword.toUpperCase(),
      page: 1,
      pageSize: 20,
    });
    expect(total).toBe(3);
    const types = items.map((i) => i.contentType).sort();
    expect(types).toEqual(["ANNOUNCEMENT", "FAQ", "PAGE"]);
  });

  it("excludes DRAFT content", async () => {
    const { items } = await service.search({ q: keyword, page: 1, pageSize: 20 });
    expect(items.some((i) => i.title.startsWith("Draft page"))).toBe(false);
  });

  it("excludes banners — they are images/links, not searchable text content", async () => {
    const { items } = await service.search({ q: keyword, page: 1, pageSize: 20 });
    expect(items.some((i) => i.contentType === "BANNER")).toBe(false);
  });

  it("returns an excerpt and no results for an unmatched query", async () => {
    const { items, total } = await service.search({
      q: `nonexistent-${suffix}`,
      page: 1,
      pageSize: 20,
    });
    expect(total).toBe(0);
    expect(items).toEqual([]);
  });

  it("paginates combined results", async () => {
    const page1 = await service.search({ q: keyword, page: 1, pageSize: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(3);

    const page2 = await service.search({ q: keyword, page: 2, pageSize: 2 });
    expect(page2.items).toHaveLength(1);
  });
});
