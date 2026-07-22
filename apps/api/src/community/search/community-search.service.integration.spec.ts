import { Test, type TestingModule } from "@nestjs/testing";
import type { RequestUser } from "../../auth/types/request-user";
import { PermissionsService } from "../../permissions/permissions.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ensureRolesAndPermissions } from "../../../test/support/seed-helpers";
import { CommunityAccessService } from "../common/community-access.service";
import { CommunitySearchService } from "./community-search.service";

describe("CommunitySearchService (integration)", () => {
  let service: CommunitySearchService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let boardId: string;
  let authorId: string;
  const suffix = `${Date.now()}`;
  const student: RequestUser = { id: "", email: "s@example.test", roles: ["STUDENT"] };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        CommunitySearchService,
        CommunityAccessService,
        PermissionsService,
        PrismaService,
      ],
    }).compile();
    service = moduleRef.get(CommunitySearchService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
    await ensureRolesAndPermissions(prisma);

    const author = await prisma.user.create({
      data: { email: `search-author-${suffix}@example.test`, status: "ACTIVE" },
    });
    authorId = author.id;
    student.id = authorId;

    const category = await prisma.forumCategory.create({
      data: { title: `SCat ${suffix}`, slug: `scat-${suffix}` },
    });
    const board = await prisma.forumBoard.create({
      data: { categoryId: category.id, title: `SBoard ${suffix}`, slug: `sboard-${suffix}` },
    });
    boardId = board.id;

    await prisma.thread.create({
      data: {
        boardId,
        authorId,
        title: `Pixel art techniques ${suffix}`,
        body: "Discussing shading",
      },
    });
    const hiddenMatch = await prisma.thread.create({
      data: { boardId, authorId, title: `Hidden pixel thread ${suffix}`, body: "hidden body" },
    });
    await prisma.thread.update({ where: { id: hiddenMatch.id }, data: { isHidden: true } });
    await prisma.thread.create({
      data: { boardId, authorId, title: `Unrelated topic ${suffix}`, body: "nothing matching" },
    });
  });

  afterAll(async () => {
    await prisma.thread.deleteMany({ where: { boardId } });
    await prisma.forumBoard.deleteMany({ where: { id: boardId } });
    await prisma.user.deleteMany({ where: { id: authorId } });
    await moduleRef.close();
  });

  it("matches on title/body keyword, case-insensitively, and excludes hidden threads", async () => {
    const { items, total } = await service.search(student, {
      q: "PIXEL",
      page: 1,
      pageSize: 20,
    });
    expect(total).toBe(1);
    expect(items[0]?.title).toContain("Pixel art techniques");
  });

  it("returns no results for a keyword that matches nothing", async () => {
    const { items, total } = await service.search(student, {
      q: `nomatch-${suffix}`,
      page: 1,
      pageSize: 20,
    });
    expect(total).toBe(0);
    expect(items).toHaveLength(0);
  });
});
