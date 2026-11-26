/**
 * Sample assignments with deadlines relative to "now", so the Assignments
 * dashboard shows every state for the demo student: a new one, one due in two
 * days (draft), one with changes requested, one waiting for review. Each seed
 * run moves the dates along so the demo stays current.
 */
import type { PrismaClient } from "../generated/client/index.js";
import { deterministicUuid } from "./seed-id.js";

const sid = (label: string) => deterministicUuid("examora-student-module-seed", label);
const DAY = 86_400_000;

const RULES = {
  allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
  maxFileSizeMb: 20,
  maxFiles: 5,
};

const LIVE = [
  {
    key: "poster-water",
    title: "Poster: Save Water, Save Life",
    brief:
      "Design an A3 poster that makes students turn off a running tap. One strong image, one short line of text. Submit the final poster and two rough thumbnails.",
    marks: "20",
    publishedDaysAgo: 0,
    dueInDays: 9,
    submission: null,
  },
  {
    key: "lunchbox",
    title: "Product Sketch: A Lunch Box for Kids",
    brief:
      "Sketch a lunch box a 7-year-old can open with one hand. Show front and top views, how it opens, and one detail that keeps food from mixing.",
    marks: "25",
    publishedDaysAgo: 6,
    dueInDays: 2,
    submission: "DRAFT",
  },
  {
    key: "festival-colours",
    title: "Colour Study: Indian Festivals",
    brief:
      "Make three colour palettes (5 colours each) inspired by three festivals, with a small sketch using each palette. Explain your choices in two lines per palette.",
    marks: "30",
    publishedDaysAgo: 10,
    dueInDays: 6,
    submission: "REVISION_REQUESTED",
  },
  {
    key: "club-logo",
    title: "Logo for Your School's Art Club",
    brief:
      "Design a logo for an art club. Show 6 quick ideas, then develop one in black and white and in colour, at large and small sizes.",
    marks: "20",
    publishedDaysAgo: 12,
    dueInDays: 12,
    submission: "SUBMITTED",
  },
] as const;

export async function seedLiveAssignments(
  prisma: PrismaClient,
  studentId: string,
  mentorId: string,
): Promise<string> {
  const subject = await prisma.subject.findFirst({
    where: { deletedAt: null, course: { title: "NID UG | UCEED", deletedAt: null } },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  if (!subject) return "live assignments skipped (no NID UG | UCEED course)";
  const now = Date.now();
  for (const a of LIVE) {
    const id = sid(`live-assignment:${a.key}`);
    const dates = {
      publishedAt: new Date(now - a.publishedDaysAgo * DAY),
      deadline: new Date(now + a.dueInDays * DAY),
    };
    await prisma.assignment.upsert({
      where: { id },
      create: {
        id,
        subjectId: subject.id,
        title: a.title,
        slug: `live-${a.key}`,
        brief: a.brief,
        fileRules: RULES,
        marksTotal: a.marks,
        status: "PUBLISHED",
        createdById: mentorId,
        ...dates,
      },
      update: dates,
    });
    if (!a.submission) continue;
    const subId = sid(`live-submission:${a.key}`);
    await prisma.assignmentSubmission.upsert({
      where: { id: subId },
      create: {
        id: subId,
        assignmentId: id,
        studentId,
        version: 1,
        status: a.submission,
        notes: a.submission === "DRAFT" ? "Started the front view; top view next." : null,
        submittedAt: a.submission === "DRAFT" ? null : new Date(now - 2 * DAY),
        reviewerId: a.submission === "DRAFT" ? null : mentorId,
      },
      update: {},
    });
    if (a.submission === "REVISION_REQUESTED") {
      await prisma.assignmentReview.upsert({
        where: { submissionId: subId },
        create: {
          submissionId: subId,
          reviewerId: mentorId,
          status: "PUBLISHED",
          decision: "REVISION_REQUESTED",
          overallComment:
            "Lovely Holi palette! The Diwali one is too close to it: try deeper golds and maroons, and redo that sketch.",
          publishedAt: new Date(now - DAY),
        },
        update: {},
      });
    }
  }
  return `${LIVE.length} live sample assignments`;
}
