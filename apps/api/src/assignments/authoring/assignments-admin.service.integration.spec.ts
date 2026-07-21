import { BadRequestException, ConflictException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { AssignmentsAdminService } from "./assignments-admin.service";

describe("AssignmentsAdminService (integration)", () => {
  let assignments: AssignmentsAdminService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  const actorId = "00000000-0000-4000-8000-000000000003";
  const createdAssignmentIds: string[] = [];
  const createdTemplateIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [AssignmentsAdminService, PrismaService],
    }).compile();
    assignments = moduleRef.get(AssignmentsAdminService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.assignment.deleteMany({ where: { id: { in: createdAssignmentIds } } });
    await prisma.assignmentTemplate.deleteMany({ where: { id: { in: createdTemplateIds } } });
    await moduleRef.close();
  });

  function unique(label: string): string {
    return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const fileRules = { allowedMimeTypes: ["image/png"], maxFileSizeMb: 10, maxFiles: 3 };

  it("creates an assignment in DRAFT with an auto-derived slug", async () => {
    const assignment = await assignments.create(
      { title: unique("Poster Design"), brief: "Design a poster", fileRules, marksTotal: 20 },
      actorId,
    );
    createdAssignmentIds.push(assignment.id);
    expect(assignment.status).toBe("DRAFT");
    expect(assignment.slug).toMatch(/^poster-design-/);
  });

  it("creates an assignment from a template, copying brief/fileRules/marksTotal/rubric", async () => {
    const template = await prisma.assignmentTemplate.create({
      data: {
        title: unique("Template"),
        brief: "Template brief",
        fileRules,
        marksTotal: 15,
        rubric: [{ title: "Creativity", maxMarks: 15 }],
      },
    });
    createdTemplateIds.push(template.id);

    const assignment = await assignments.create(
      { title: unique("From Template"), templateId: template.id },
      actorId,
    );
    createdAssignmentIds.push(assignment.id);
    expect(Number(assignment.marksTotal)).toBe(15);
    expect(assignment.criteria).toHaveLength(1);
    expect(assignment.criteria[0]?.title).toBe("Creativity");
  });

  it("rejects a duplicate slug", async () => {
    const slug = unique("dup-assignment");
    const first = await assignments.create(
      { title: "First", slug, brief: "b", fileRules, marksTotal: 10 },
      actorId,
    );
    createdAssignmentIds.push(first.id);
    await expect(
      assignments.create({ title: "Second", slug, brief: "b", fileRules, marksTotal: 10 }, actorId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("refuses to publish an assignment with no rubric criteria", async () => {
    const assignment = await assignments.create(
      { title: unique("No Rubric"), brief: "b", fileRules, marksTotal: 10 },
      actorId,
    );
    createdAssignmentIds.push(assignment.id);
    await expect(assignments.changeStatus(assignment.id, "PUBLISHED")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("publishes once a rubric criterion exists", async () => {
    const assignment = await assignments.create(
      { title: unique("Ready"), brief: "b", fileRules, marksTotal: 10 },
      actorId,
    );
    createdAssignmentIds.push(assignment.id);
    await assignments.addCriterion(assignment.id, { title: "Quality", maxMarks: 10 });

    const published = await assignments.changeStatus(assignment.id, "PUBLISHED");
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).not.toBeNull();
  });

  it("refuses to delete a PUBLISHED assignment until archived", async () => {
    const assignment = await assignments.create(
      { title: unique("Delete Guard"), brief: "b", fileRules, marksTotal: 10 },
      actorId,
    );
    createdAssignmentIds.push(assignment.id);
    await assignments.addCriterion(assignment.id, { title: "Quality", maxMarks: 10 });
    await assignments.changeStatus(assignment.id, "PUBLISHED");

    await expect(assignments.remove(assignment.id)).rejects.toBeInstanceOf(BadRequestException);
    await assignments.changeStatus(assignment.id, "ARCHIVED");
    await assignments.remove(assignment.id);
  });
});
