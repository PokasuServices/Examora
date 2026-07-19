import { BadRequestException, ConflictException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { CoursesService } from "../courses/courses.service";
import { SubjectsService } from "./subjects.service";

/**
 * Exercises the nested-resource pattern (parent validation + per-parent slug
 * uniqueness + position) via Subject; the same code shape backs Topic/Module/Lesson.
 */
describe("SubjectsService (integration)", () => {
  let subjects: SubjectsService;
  let courses: CoursesService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  const actorId = "00000000-0000-4000-8000-000000000002";
  let courseAId: string;
  let courseBId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [SubjectsService, CoursesService, PrismaService],
    }).compile();
    subjects = moduleRef.get(SubjectsService);
    courses = moduleRef.get(CoursesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    courseAId = (await courses.create({ title: `Course A ${suffix}` }, actorId)).id;
    courseBId = (await courses.create({ title: `Course B ${suffix}` }, actorId)).id;
  });

  afterAll(async () => {
    await prisma.course.deleteMany({ where: { id: { in: [courseAId, courseBId] } } });
    await moduleRef.close();
  });

  it("rejects a subject under a non-existent course", async () => {
    await expect(
      subjects.create(
        { courseId: "33333333-3333-4333-8333-333333333333", title: "Orphan" },
        actorId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("assigns incrementing positions within a course", async () => {
    const first = await subjects.create({ courseId: courseAId, title: "First Subject" }, actorId);
    const second = await subjects.create({ courseId: courseAId, title: "Second Subject" }, actorId);
    expect(second.position).toBe(first.position + 1);
  });

  it("enforces slug uniqueness within a course but allows the same slug in another course", async () => {
    await subjects.create({ courseId: courseAId, title: "Shared Name", slug: "shared" }, actorId);

    await expect(
      subjects.create({ courseId: courseAId, title: "Shared Name Again", slug: "shared" }, actorId),
    ).rejects.toBeInstanceOf(ConflictException);

    // Same slug is fine under a different course.
    const inB = await subjects.create(
      { courseId: courseBId, title: "Shared Name", slug: "shared" },
      actorId,
    );
    expect(inB.slug).toBe("shared");
  });

  it("soft-deletes and hides from list", async () => {
    const subject = await subjects.create({ courseId: courseBId, title: "To Delete" }, actorId);
    await subjects.remove(subject.id);
    const { items } = await subjects.list({ courseId: courseBId, page: 1, pageSize: 50 });
    expect(items.find((s) => s.id === subject.id)).toBeUndefined();
  });
});
