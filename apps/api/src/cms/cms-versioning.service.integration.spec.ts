import { randomUUID } from "node:crypto";
import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { CmsVersioningService } from "./cms-versioning.service";

describe("CmsVersioningService (integration)", () => {
  let service: CmsVersioningService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let authorId: string;
  const suffix = Date.now();
  const contentId = randomUUID();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [CmsVersioningService, PrismaService],
    }).compile();
    service = moduleRef.get(CmsVersioningService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const author = await prisma.user.create({
      data: { email: `cms-version-author-${suffix}@example.test`, status: "ACTIVE" },
    });
    authorId = author.id;
  });

  afterAll(async () => {
    await prisma.cmsContentVersion.deleteMany({ where: { createdById: authorId } });
    await prisma.user.deleteMany({ where: { id: authorId } });
    await moduleRef.close();
  });

  it("assigns version 1 to the first snapshot of a (contentType, contentId)", async () => {
    const versionNumber = await service.recordVersion({
      contentType: "PAGE",
      contentId,
      snapshot: { title: "v1" },
      status: "DRAFT",
      actorId: authorId,
      changeNote: "Created",
    });
    expect(versionNumber).toBe(1);
  });

  it("peekNextVersionNumber previews the next number without recording anything", async () => {
    const peeked = await service.peekNextVersionNumber("PAGE", contentId);
    expect(peeked).toBe(2);
    // Calling it again must return the same value — it must not have side effects.
    expect(await service.peekNextVersionNumber("PAGE", contentId)).toBe(2);
  });

  it("increments per (contentType, contentId), independent of other content", async () => {
    const secondVersion = await service.recordVersion({
      contentType: "PAGE",
      contentId,
      snapshot: { title: "v2" },
      status: "IN_REVIEW",
      actorId: authorId,
    });
    expect(secondVersion).toBe(2);

    const otherContentFirstVersion = await service.recordVersion({
      contentType: "FAQ",
      contentId,
      snapshot: { question: "q" },
      status: "DRAFT",
      actorId: authorId,
    });
    expect(otherContentFirstVersion).toBe(1);
  });

  it("listVersions returns newest-first with the author's email resolved", async () => {
    const versions = await service.listVersions("PAGE", contentId);
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 1]);
    expect(versions[0]!.createdBy.email).toBe(`cms-version-author-${suffix}@example.test`);
  });

  it("getVersionOrThrow returns the requested version", async () => {
    const version = await service.getVersionOrThrow("PAGE", contentId, 1);
    expect(version.snapshot).toEqual({ title: "v1" });
  });

  it("getVersionOrThrow throws NotFoundException for a version that doesn't exist", async () => {
    await expect(service.getVersionOrThrow("PAGE", contentId, 99)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("compareVersions reports only changed fields, treating missing keys as null", async () => {
    const diffs = service.compareVersions(
      { title: "v1", seoTitle: null },
      { title: "v2", seoTitle: "New SEO" },
    );
    expect(diffs).toEqual(
      expect.arrayContaining([
        { field: "title", before: "v1", after: "v2" },
        { field: "seoTitle", before: null, after: "New SEO" },
      ]),
    );
    expect(diffs).toHaveLength(2);
  });

  it("compareVersions reports no diffs for identical snapshots", async () => {
    expect(service.compareVersions({ title: "same" }, { title: "same" })).toEqual([]);
  });
});
