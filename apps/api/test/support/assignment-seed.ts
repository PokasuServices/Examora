import type { PrismaService } from "../../src/prisma/prisma.service";

export interface SeededAssignment {
  assignmentId: string;
  criterionIds: string[];
  cleanup: () => Promise<void>;
}

/**
 * Seeds a PUBLISHED assignment with `criterionCount` rubric criteria —
 * directly via Prisma (bypasses the assignment services so submission/review
 * tests are self-contained, mirroring test/support/assessment-seed.ts).
 */
export async function seedPublishedAssignment(
  prisma: PrismaService,
  opts: {
    criterionCount?: number;
    maxMarksPerCriterion?: number;
    maxFiles?: number;
    maxFileSizeMb?: number;
    allowedMimeTypes?: string[];
  } = {},
): Promise<SeededAssignment> {
  const criterionCount = opts.criterionCount ?? 2;
  const maxMarksPerCriterion = opts.maxMarksPerCriterion ?? 10;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const assignment = await prisma.assignment.create({
    data: {
      title: `Seed Assignment ${suffix}`,
      slug: `seed-assignment-${suffix}`,
      brief: "Seed brief",
      status: "PUBLISHED",
      publishedAt: new Date(),
      marksTotal: criterionCount * maxMarksPerCriterion,
      fileRules: {
        allowedMimeTypes: opts.allowedMimeTypes ?? ["image/png", "image/jpeg", "application/pdf"],
        maxFileSizeMb: opts.maxFileSizeMb ?? 10,
        maxFiles: opts.maxFiles ?? 5,
      },
      criteria: {
        create: Array.from({ length: criterionCount }, (_, i) => ({
          title: `Criterion ${i + 1}`,
          maxMarks: maxMarksPerCriterion,
          position: i,
        })),
      },
    },
    include: { criteria: true },
  });

  return {
    assignmentId: assignment.id,
    criterionIds: assignment.criteria.map((c) => c.id),
    cleanup: async () => {
      await prisma.assignment.deleteMany({ where: { id: assignment.id } });
    },
  };
}
