/**
 * Sample exam tags on the NID UG | UCEED topics (which other exams each topic
 * also counts for), plus a few demo-student labels (favourite / on hold), so
 * the Learn dashboard's "shared topics" and "my topics" filters have data.
 * Never overwrites tags an admin has already set.
 */
import type { PrismaClient } from "../generated/client/index.js";

/** Subject title → exams its topics count for. */
const BY_SUBJECT: Record<string, string[]> = {
  "Mental Ability": ["NID", "UCEED", "NATA", "NIFT"],
  "Analytical Reasoning": ["NID", "UCEED", "NIFT"],
  "Visual Spatial Ability": ["NID", "UCEED", "NATA", "CEED"],
  "General Knowledge": ["NID", "UCEED", "NIFT"],
  Mathematics: ["UCEED", "NATA", "JEE B.ARCH"],
  English: ["NID", "UCEED", "NIFT"],
  "Design Sketching": ["NID", "UCEED", "NATA", "CEED"],
  "Exam Structure": ["NID", "UCEED"],
};

const DEMO_MARKS: { topic: string; favourite?: boolean; onHold?: boolean }[] = [
  { topic: "Puzzles", favourite: true },
  { topic: "Blood Relations", favourite: true },
  { topic: "Perspective Basics", favourite: true },
  { topic: "Probability", onHold: true },
  { topic: "Idioms & Phrases", onHold: true },
];

export async function seedLearnTags(prisma: PrismaClient, studentId: string): Promise<string> {
  const topics = await prisma.topic.findMany({
    where: { deletedAt: null, subject: { deletedAt: null, course: { title: "NID UG | UCEED" } } },
    select: { id: true, title: true, examTags: true, subject: { select: { title: true } } },
  });
  let tagged = 0;
  for (const t of topics) {
    const tags = BY_SUBJECT[t.subject.title];
    if (!tags || t.examTags.length > 0) continue;
    await prisma.topic.update({ where: { id: t.id }, data: { examTags: tags } });
    tagged++;
  }
  let marked = 0;
  for (const m of DEMO_MARKS) {
    const topic = topics.find((t) => t.title === m.topic);
    if (!topic) continue;
    await prisma.topicMark.upsert({
      where: { userId_topicId: { userId: studentId, topicId: topic.id } },
      create: {
        userId: studentId,
        topicId: topic.id,
        favourite: m.favourite ?? false,
        onHold: m.onHold ?? false,
      },
      update: {},
    });
    marked++;
  }
  return `exam tags on ${tagged} topics, ${marked} demo topic labels`;
}
