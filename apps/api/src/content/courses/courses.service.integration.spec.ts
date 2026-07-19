import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { CategoriesService } from "../categories/categories.service";
import { CoursesService } from "./courses.service";

describe("CoursesService (integration)", () => {
  let courses: CoursesService;
  let categories: CategoriesService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  const actorId = "00000000-0000-4000-8000-000000000001";
  const createdCourseIds: string[] = [];
  const createdCategoryIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [CoursesService, CategoriesService, PrismaService],
    }).compile();
    courses = moduleRef.get(CoursesService);
    categories = moduleRef.get(CategoriesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await moduleRef.close();
  });

  function unique(label: string): string {
    return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  it("creates a course in DRAFT with an auto-derived slug", async () => {
    const course = await courses.create({ title: unique("Course Title") }, actorId);
    createdCourseIds.push(course.id);

    expect(course.status).toBe("DRAFT");
    expect(course.publishedAt).toBeNull();
    expect(course.slug).toMatch(/^course-title-/);
    expect(course.createdById).toBe(actorId);
  });

  it("rejects a course referencing a non-existent category", async () => {
    await expect(
      courses.create(
        { title: unique("X"), categoryId: "22222222-2222-4222-8222-222222222222" },
        actorId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a duplicate global slug", async () => {
    const slug = unique("dup-course");
    const first = await courses.create({ title: "First", slug }, actorId);
    createdCourseIds.push(first.id);
    await expect(courses.create({ title: "Second", slug }, actorId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("stamps publishedAt on first publish and preserves it across unpublish/republish", async () => {
    const course = await courses.create({ title: unique("Publish Me") }, actorId);
    createdCourseIds.push(course.id);

    const published = await courses.changeStatus(course.id, "PUBLISHED");
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).not.toBeNull();
    const firstPublishedAt = published.publishedAt;

    const unpublished = await courses.changeStatus(course.id, "DRAFT");
    expect(unpublished.status).toBe("DRAFT");
    expect(unpublished.publishedAt).toEqual(firstPublishedAt);

    const republished = await courses.changeStatus(course.id, "PUBLISHED");
    expect(republished.publishedAt).toEqual(firstPublishedAt);
  });

  it("rejects an invalid status transition (ARCHIVED -> PUBLISHED)", async () => {
    const course = await courses.create({ title: unique("Archive Me") }, actorId);
    createdCourseIds.push(course.id);
    await courses.changeStatus(course.id, "ARCHIVED");
    await expect(courses.changeStatus(course.id, "PUBLISHED")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("refuses to delete a PUBLISHED course until archived", async () => {
    const course = await courses.create({ title: unique("Delete Guard") }, actorId);
    createdCourseIds.push(course.id);
    await courses.changeStatus(course.id, "PUBLISHED");

    await expect(courses.remove(course.id)).rejects.toBeInstanceOf(BadRequestException);

    await courses.changeStatus(course.id, "ARCHIVED");
    await courses.remove(course.id);
    await expect(courses.findByIdOrThrow(course.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("filters list by status and category", async () => {
    const category = await categories.create({ name: unique("Cat") }, actorId);
    createdCategoryIds.push(category.id);
    const course = await courses.create(
      { title: unique("Filtered"), categoryId: category.id },
      actorId,
    );
    createdCourseIds.push(course.id);
    await courses.changeStatus(course.id, "PUBLISHED");

    const { items } = await courses.list({
      page: 1,
      pageSize: 50,
      status: "PUBLISHED",
      categoryId: category.id,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(course.id);
  });
});
