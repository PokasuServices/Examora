/**
 * A sample batch for the mentor module (MF0): NID UG | UCEED evening batch,
 * hybrid, Mon/Wed/Fri 18:00–19:30, run by the demo mentor, with the demo
 * student and 24 classmates. Idempotent (fixed id; members/mentors upserted).
 */
import type { PrismaClient } from "../generated/client/index.js";
import { deterministicUuid } from "./seed-id.js";

const sid = (label: string) => deterministicUuid("examora-student-module-seed", label);

export async function seedBatches(
  prisma: PrismaClient,
  ids: { studentId: string; mentorId: string },
): Promise<string> {
  const course = await prisma.course.findFirst({
    where: { title: "NID UG | UCEED", deletedAt: null },
    select: { id: true },
  });
  if (!course) return "sample batch skipped (no NID UG | UCEED course)";
  const id = sid("batch:nid-evening");
  const today = new Date();
  const startsOn = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 1));
  const endsOn = new Date(Date.UTC(today.getUTCFullYear() + 1, 4, 31));
  await prisma.cohort.upsert({
    where: { id },
    create: {
      id,
      name: "NID UG | UCEED – Evening",
      batch: "Evening",
      courseId: course.id,
      mode: "HYBRID",
      schedule: [
        { day: 1, start: "18:00", end: "19:30" },
        { day: 3, start: "18:00", end: "19:30" },
        { day: 5, start: "18:00", end: "19:30" },
      ],
      startsOn,
      endsOn,
      location: "Room 2, Examora Pune centre",
      meetingUrl: "https://meet.example.com/examora-nid-evening",
    },
    update: {},
  });
  await prisma.cohortMentor.upsert({
    where: { cohortId_mentorId: { cohortId: id, mentorId: ids.mentorId } },
    create: { cohortId: id, mentorId: ids.mentorId },
    update: {},
  });
  const classmates = await prisma.user.findMany({
    where: { email: { endsWith: "@bulk.examora.test" }, id: { not: ids.studentId } },
    orderBy: { email: "asc" },
    take: 24,
    select: { id: true },
  });
  const { count } = await prisma.cohortMember.createMany({
    data: [ids.studentId, ...classmates.map((c) => c.id)].map((userId) => ({
      cohortId: id,
      userId,
    })),
    skipDuplicates: true,
  });
  return `sample batch with ${count} new members`;
}
