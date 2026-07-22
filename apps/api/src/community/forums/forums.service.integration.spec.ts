import { ConflictException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { ForumBoardsService } from "./forum-boards.service";
import { ForumCategoriesService } from "./forum-categories.service";

describe("Forum categories/boards services (integration)", () => {
  let categoriesService: ForumCategoriesService;
  let boardsService: ForumBoardsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let actorId: string;
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [ForumCategoriesService, ForumBoardsService, PrismaService],
    }).compile();
    categoriesService = moduleRef.get(ForumCategoriesService);
    boardsService = moduleRef.get(ForumBoardsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const actor = await prisma.user.create({
      data: { email: `forum-admin-${suffix}@example.test`, status: "ACTIVE" },
    });
    actorId = actor.id;
  });

  afterAll(async () => {
    await prisma.forumBoard.deleteMany({ where: { createdById: actorId } });
    await prisma.forumCategory.deleteMany({ where: { createdById: actorId } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await moduleRef.close();
  });

  it("derives a slug from the title when none is given, and rejects a duplicate", async () => {
    const category = await categoriesService.create({ title: "General Talk" }, actorId);
    expect(category.slug).toBe("general-talk");

    await expect(
      categoriesService.create({ title: "General Talk" }, actorId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("assigns increasing positions when none is given", async () => {
    const c1 = await categoriesService.create({ title: `Pos A ${suffix}` }, actorId);
    const c2 = await categoriesService.create({ title: `Pos B ${suffix}` }, actorId);
    expect(c2.position).toBeGreaterThan(c1.position);
  });

  it("soft-deletes a category so it no longer appears in list() or findByIdOrThrow()", async () => {
    const category = await categoriesService.create({ title: `Removable ${suffix}` }, actorId);
    await categoriesService.remove(category.id);
    await expect(categoriesService.findByIdOrThrow(category.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("boards are scoped to a category — the same slug is allowed in a different category", async () => {
    const categoryA = await categoriesService.create({ title: `Cat A ${suffix}` }, actorId);
    const categoryB = await categoriesService.create({ title: `Cat B ${suffix}` }, actorId);

    const boardA = await boardsService.create(
      { categoryId: categoryA.id, title: "General", slug: "general" },
      actorId,
    );
    const boardB = await boardsService.create(
      { categoryId: categoryB.id, title: "General", slug: "general" },
      actorId,
    );
    expect(boardA.slug).toBe(boardB.slug);

    await expect(
      boardsService.create(
        { categoryId: categoryA.id, title: "General 2", slug: "general" },
        actorId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects creating a board under a nonexistent category", async () => {
    await expect(
      boardsService.create(
        { categoryId: "11111111-1111-1111-1111-111111111111", title: "Orphan" },
        actorId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("list() filters boards by categoryId", async () => {
    const category = await categoriesService.create({ title: `Filter Cat ${suffix}` }, actorId);
    const board = await boardsService.create(
      { categoryId: category.id, title: "Only here" },
      actorId,
    );

    const { items } = await boardsService.list({ page: 1, pageSize: 20, categoryId: category.id });
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(board.id);
  });
});
