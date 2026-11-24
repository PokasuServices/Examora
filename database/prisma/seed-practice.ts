/**
 * Phases 4–8 sample data (student module redesign). All content is original
 * and the colleges/webinars are fictional, for testing only.
 *
 *  - links existing sample questions to their topics (for report analysis)
 *  - Practice categories with three mock tests that unlock in order, each with
 *    an aptitude section and a sketching (UPLOAD) section
 *  - the demo student's finished, analysed attempt at Mock Test 1 (methods,
 *    time, a reviewed sketch) and other students' first attempts for rankings
 *  - a daily-quiz question pool, doubts with claps, a cohort, checkpoints,
 *    a goal, fictional colleges and webinars
 */
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Prisma, PrismaClient } from "../generated/client/index.js";
import { FIGURE_P, mirror, patternPng, rotate90 } from "./seed-images.js";
import { deterministicUuid } from "./seed-id.js";

const sid = (label: string) => deterministicUuid("examora-student-module-seed", label);
const qid = (quiz: string, i: number) => sid(`question:${quiz}/${i}`);
const oid = (quiz: string, i: number, o: number) => sid(`option:${quiz}/${i}/${o}`);
const courseId = sid("course:nid-ug-uceed");

/** quiz key → [subject key, topic key, question count] (from seed-student-content / seed-question-engine). */
const SAMPLE_QUIZZES: Record<string, [string, string, number]> = {
  "clock-puzzles": ["mental-ability", "puzzles", 5],
  "number-puzzles": ["mental-ability", "puzzles", 5],
  "puzzles-review": ["mental-ability", "puzzles", 4],
  "blood-relations-quiz": ["mental-ability", "blood-relations", 4],
  "av-terminology-quiz": ["general-knowledge", "av-terminology", 10],
  "rotation-practice": ["visual-spatial", "rotation", 5],
};

async function linkQuestionTopics(prisma: PrismaClient): Promise<void> {
  for (const [quiz, [subject, topic, count]] of Object.entries(SAMPLE_QUIZZES)) {
    await prisma.question.updateMany({
      where: { id: { in: Array.from({ length: count }, (_, i) => qid(quiz, i)) }, topicId: null },
      data: { topicId: sid(`topic:${subject}/${topic}`) },
    });
  }
}

// ---------------------------------------------------------------------------
// Practice tests
// ---------------------------------------------------------------------------

const CATEGORIES = [
  {
    key: "mock-tests",
    title: "Mock tests",
    description: "Full-length timed tests in exam format.",
  },
  {
    key: "past-paper-style",
    title: "Past-paper style",
    description: "Sets modelled on previous years' papers.",
  },
  {
    key: "predicted-sets",
    title: "Predicted sets",
    description: "Short sets on topics likely to appear.",
  },
];

/** [quiz key, question index] picks for each mock test's aptitude section. */
const MOCK_TESTS: { key: string; title: string; picks: [string, number][] }[] = [
  {
    key: "mock-test-1",
    title: "Mock Test 1",
    picks: [
      ["clock-puzzles", 0],
      ["clock-puzzles", 1],
      ["clock-puzzles", 2],
      ["number-puzzles", 0],
      ["number-puzzles", 1],
      ["number-puzzles", 2],
      ["blood-relations-quiz", 0],
      ["blood-relations-quiz", 1],
      ["av-terminology-quiz", 0],
      ["av-terminology-quiz", 1],
      ["av-terminology-quiz", 2],
      ["av-terminology-quiz", 3],
      ["rotation-practice", 0],
      ["rotation-practice", 1],
      ["rotation-practice", 2],
      ["rotation-practice", 3],
    ],
  },
  {
    key: "mock-test-2",
    title: "Mock Test 2",
    picks: [
      ["clock-puzzles", 3],
      ["clock-puzzles", 4],
      ["number-puzzles", 3],
      ["number-puzzles", 4],
      ["blood-relations-quiz", 2],
      ["blood-relations-quiz", 3],
      ["av-terminology-quiz", 4],
      ["av-terminology-quiz", 5],
      ["av-terminology-quiz", 6],
      ["av-terminology-quiz", 7],
      ["rotation-practice", 4],
      ["puzzles-review", 0],
      ["puzzles-review", 1],
    ],
  },
  {
    key: "mock-test-3",
    title: "Mock Test 3",
    picks: [
      ["puzzles-review", 2],
      ["puzzles-review", 3],
      ["av-terminology-quiz", 8],
      ["av-terminology-quiz", 9],
      ["clock-puzzles", 0],
      ["number-puzzles", 0],
      ["blood-relations-quiz", 0],
      ["rotation-practice", 2],
    ],
  },
];

const SKETCH_CRITERIA = ["Observation", "Composition", "Perspective", "Line quality", "Detail"];

async function seedSketchQuestion(prisma: PrismaClient, adminId: string): Promise<string> {
  const id = sid("question:sketch-platform");
  await prisma.question.upsert({
    where: { id },
    update: {},
    create: {
      id,
      subjectId: sid("subject:design-sketching"),
      topicId: sid("topic:design-sketching/perspective"),
      type: "UPLOAD",
      difficulty: "MEDIUM",
      text:
        "Sketch a busy bus terminus seen from an upper-floor window: people waiting, a bus pulling in, " +
        "vendors and signboards. Show depth using perspective. Pencil only; no colour.",
      criteria: SKETCH_CRITERIA,
      explanation:
        "Good answers pick a clear vanishing point, overlap figures to show depth, vary line weight, and include small observed details.",
      status: "PUBLISHED",
      createdById: adminId,
    },
  });
  return id;
}

async function seedPracticeTests(prisma: PrismaClient, adminId: string): Promise<void> {
  for (const [i, c] of CATEGORIES.entries()) {
    await prisma.practiceCategory.upsert({
      where: { courseId_slug: { courseId, slug: c.key } },
      update: {},
      create: {
        id: sid(`practice:${c.key}`),
        courseId,
        title: c.title,
        slug: c.key,
        description: c.description,
        position: i,
      },
    });
  }
  const sketchId = await seedSketchQuestion(prisma, adminId);
  const mockCategory = sid("practice:mock-tests");

  let previous: string | null = null;
  for (const [n, t] of MOCK_TESTS.entries()) {
    const quizId = sid(`quiz:${t.key}`);
    const exists = await prisma.quiz.findUnique({ where: { id: quizId }, select: { id: true } });
    if (!exists) {
      await prisma.quiz.create({
        data: {
          id: quizId,
          subjectId: sid("subject:mental-ability"),
          practiceCategoryId: mockCategory,
          unlockAfterQuizId: previous,
          requireAllVisited: true,
          title: t.title,
          slug: `nid-${t.key}`,
          description:
            "Section A: aptitude (single answer, multi-select and numeric; −0.25 for a wrong single-answer question). " +
            "Section B: one sketching question, marked by a reviewer.",
          timeLimitMinutes: 30,
          maxAttempts: 3,
          xpReward: 100,
          level: "MEDIUM",
          position: n,
          status: "PUBLISHED",
          publishedAt: new Date(),
          createdById: adminId,
          sections: {
            create: [
              { id: sid(`section:${t.key}/a`), title: "Section A: Aptitude", position: 0 },
              { id: sid(`section:${t.key}/b`), title: "Section B: Sketching", position: 1 },
            ],
          },
        },
      });
      const rows: Prisma.QuizQuestionCreateManyInput[] = t.picks.map(([quiz, i], pos) => ({
        id: sid(`quiz-question:${t.key}/${pos}`),
        quizId,
        questionId: qid(quiz, i),
        sectionId: sid(`section:${t.key}/a`),
        marks: quiz === "rotation-practice" && i === 1 ? 2 : 1,
        negativeMarks: quiz === "rotation-practice" && (i === 2 || i === 3) ? null : 0.25,
        position: pos,
      }));
      rows.push({
        id: sid(`quiz-question:${t.key}/sketch`),
        quizId,
        questionId: sketchId,
        sectionId: sid(`section:${t.key}/b`),
        marks: 10,
        position: rows.length,
      });
      await prisma.quizQuestion.createMany({ data: rows, skipDuplicates: true });
    }
    previous = quizId;
  }
}

// ---------------------------------------------------------------------------
// Attempts (demo student's analysed attempt + others for rankings)
// ---------------------------------------------------------------------------

async function uploadPng(key: string, body: Buffer): Promise<boolean> {
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET ?? "examora-uploads",
        Key: key,
        Body: body,
        ContentType: "image/png",
      }),
      { abortSignal: controller.signal },
    );
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
    client.destroy();
  }
}

type Plan = {
  outcome: "right" | "wrong" | "skip" | "partial";
  method: "KNOWLEDGE" | "ELIMINATION" | "GUESS";
  seconds: number;
};

/** Demo student's answers for Mock Test 1, one per pick, chosen to exercise every report section. */
const DEMO_PLAN: Plan[] = [
  { outcome: "right", method: "KNOWLEDGE", seconds: 25 },
  { outcome: "right", method: "KNOWLEDGE", seconds: 40 },
  { outcome: "wrong", method: "KNOWLEDGE", seconds: 95 },
  { outcome: "right", method: "KNOWLEDGE", seconds: 20 },
  { outcome: "right", method: "ELIMINATION", seconds: 70 },
  { outcome: "skip", method: "KNOWLEDGE", seconds: 15 },
  { outcome: "right", method: "KNOWLEDGE", seconds: 30 },
  { outcome: "wrong", method: "KNOWLEDGE", seconds: 120 },
  { outcome: "right", method: "KNOWLEDGE", seconds: 12 },
  { outcome: "right", method: "GUESS", seconds: 8 },
  { outcome: "wrong", method: "GUESS", seconds: 10 },
  { outcome: "right", method: "KNOWLEDGE", seconds: 18 },
  { outcome: "right", method: "KNOWLEDGE", seconds: 45 },
  { outcome: "partial", method: "ELIMINATION", seconds: 80 },
  { outcome: "right", method: "KNOWLEDGE", seconds: 100 },
  { outcome: "skip", method: "KNOWLEDGE", seconds: 0 },
];

async function seedDemoAttempt(
  prisma: PrismaClient,
  studentId: string,
  adminId: string,
): Promise<void> {
  const test = MOCK_TESTS[0]!;
  const quizId = sid(`quiz:${test.key}`);
  const attemptId = sid(`attempt:${test.key}/demo`);
  if (await prisma.quizAttempt.findUnique({ where: { id: attemptId }, select: { id: true } }))
    return;

  const qq = await prisma.quizQuestion.findMany({
    where: { quizId },
    orderBy: { position: "asc" },
    include: { question: { include: { options: { orderBy: { position: "asc" } } } } },
  });
  const startedAt = new Date(Date.now() - 4 * 86_400_000);
  let obtained = 0;
  let total = 0;
  const answers: Prisma.QuizAttemptAnswerCreateManyInput[] = [];
  let sketchAnswerId: string | null = null;

  for (const [i, row] of qq.entries()) {
    const q = row.question;
    const marks = Number(row.marks);
    total += marks;
    const penalty = row.negativeMarks === null ? 0 : Number(row.negativeMarks);
    const answerId = sid(`answer:${test.key}/demo/${i}`);
    const base = {
      id: answerId,
      attemptId,
      questionId: q.id,
      visitedAt: startedAt,
      answeredAt: startedAt,
    };

    if (q.type === "UPLOAD") {
      const png = patternPng(rotate90(mirror(FIGURE_P)), 40);
      const assetId = sid("media:demo-sketch");
      const key = "study-media/sample/demo-sketch.png";
      const haveAsset = await prisma.cmsAsset.findUnique({
        where: { id: assetId },
        select: { id: true },
      });
      if (!haveAsset && (await uploadPng(key, png))) {
        await prisma.cmsAsset.create({
          data: {
            id: assetId,
            storageKey: key,
            fileName: "demo-sketch.png",
            mimeType: "image/png",
            sizeBytes: png.length,
            uploadedById: studentId,
            scanStatus: "CLEAN",
          },
        });
      }
      const uploaded = Boolean(
        await prisma.cmsAsset.findUnique({ where: { id: assetId }, select: { id: true } }),
      );
      answers.push({
        ...base,
        selectedOptionIds: [],
        uploadAssetId: uploaded ? assetId : null,
        isCorrect: uploaded ? true : null,
        marksAwarded: uploaded ? 7 : 0,
        timeSpentSeconds: 600,
      });
      if (uploaded) {
        obtained += 7;
        sketchAnswerId = answerId;
      }
      continue;
    }

    const plan = DEMO_PLAN[i] ?? { outcome: "skip", method: "KNOWLEDGE", seconds: 0 };
    const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
    const wrongId = q.options.find((o) => !o.isCorrect)?.id;
    let selected: string[] = [];
    let numeric: number | null = null;
    let isCorrect: boolean | null = null;
    let awarded = 0;
    if (plan.outcome !== "skip") {
      if (q.type === "NUMERIC") {
        const right = Number(q.numericMin);
        numeric = plan.outcome === "wrong" ? right + 10 : right;
      } else if (plan.outcome === "partial") {
        selected = correctIds.slice(0, 1);
      } else {
        selected = plan.outcome === "right" ? correctIds : wrongId ? [wrongId] : [];
      }
      if (plan.outcome === "right") {
        isCorrect = true;
        awarded = marks;
      } else if (plan.outcome === "partial") {
        isCorrect = true;
        awarded = Math.round((marks / Math.max(correctIds.length, 1)) * 100) / 100;
      } else {
        isCorrect = false;
        awarded = -penalty;
      }
    }
    obtained += awarded;
    answers.push({
      ...base,
      selectedOptionIds: selected,
      numericAnswer: numeric,
      isCorrect,
      marksAwarded: awarded,
      method: plan.outcome === "skip" ? null : plan.method,
      timeSpentSeconds: plan.seconds,
      answeredAt: plan.outcome === "skip" ? null : startedAt,
    });
  }

  obtained = Math.round(obtained * 100) / 100;
  const submittedAt = new Date(startedAt.getTime() + 26 * 60_000);
  await prisma.quizAttempt.create({
    data: {
      id: attemptId,
      quizId,
      userId: studentId,
      status: "SUBMITTED",
      questionSnapshot: qq.map((r) => ({
        questionId: r.questionId,
        sectionId: r.sectionId,
        marks: Number(r.marks),
        negativeMarks: r.negativeMarks === null ? null : Number(r.negativeMarks),
      })),
      optionOrder: Object.fromEntries(
        qq.map((r) => [r.questionId, r.question.options.map((o) => o.id)]),
      ),
      passingScorePercent: 40,
      negativeMarkingEnabled: false,
      negativeMarksPerWrong: 0,
      totalMarks: total,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + 30 * 60_000),
      submittedAt,
      obtainedMarks: obtained,
      percentage: Math.round((obtained / total) * 10000) / 100,
      passed: obtained / total >= 0.4,
      correctCount: answers.filter((a) => a.isCorrect === true).length,
      wrongCount: answers.filter((a) => a.isCorrect === false).length,
      unansweredCount: answers.filter((a) => a.isCorrect === null).length,
    },
  });
  await prisma.quizAttemptAnswer.createMany({ data: answers });
  if (sketchAnswerId) {
    const self = { Observation: 4, Composition: 3, Perspective: 3, "Line quality": 4, Detail: 3 };
    const expert = { Observation: 4, Composition: 3, Perspective: 4, "Line quality": 3, Detail: 3 };
    await prisma.sketchReview.create({
      data: {
        answerId: sketchAnswerId,
        selfScores: self,
        selfRatedAt: submittedAt,
        expertScores: expert,
        expertComment:
          "Good depth from the high viewpoint. Vary line weight more between near and far figures.",
        expertId: adminId,
        expertReviewedAt: new Date(submittedAt.getTime() + 86_400_000),
      },
    });
  }
  // One flagged question for the Revision tab.
  await prisma.quizAttemptAnswer.updateMany({
    where: { id: sid(`answer:${test.key}/demo/2`) },
    data: { flagged: true },
  });
}

/** Other students' first attempts at Mock Test 1, so rank, percentile and the leaderboard have data. */
async function seedRankingAttempts(prisma: PrismaClient): Promise<number> {
  const quizId = sid("quiz:mock-test-1");
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { quizQuestions: { select: { questionId: true, sectionId: true, marks: true } } },
  });
  if (!quiz) return 0;
  const students = await prisma.user.findMany({
    where: {
      email: { endsWith: "@bulk.examora.test" },
      roles: { some: { role: { name: "STUDENT" } } },
    },
    orderBy: { email: "asc" },
    take: 24,
    select: { id: true },
  });
  const total = quiz.quizQuestions.reduce((s, q) => s + Number(q.marks), 0);
  const rows: Prisma.QuizAttemptCreateManyInput[] = students.map((s, i) => {
    const obtained = Math.round(((i * 7) % 24) + 2 + (i % 3) * 0.75);
    const startedAt = new Date(Date.now() - (6 + (i % 4)) * 86_400_000);
    return {
      id: sid(`attempt:mock-test-1/bulk/${i}`),
      quizId,
      userId: s.id,
      status: "SUBMITTED",
      questionSnapshot: quiz.quizQuestions.map((q) => ({
        questionId: q.questionId,
        sectionId: q.sectionId,
        marks: Number(q.marks),
      })),
      optionOrder: {},
      passingScorePercent: 40,
      negativeMarkingEnabled: false,
      negativeMarksPerWrong: 0,
      totalMarks: total,
      startedAt,
      submittedAt: new Date(startedAt.getTime() + (14 + (i % 15)) * 60_000),
      obtainedMarks: Math.min(obtained, total),
      percentage: Math.round((Math.min(obtained, total) / total) * 10000) / 100,
      passed: obtained / total >= 0.4,
      correctCount: 0,
      wrongCount: 0,
      unansweredCount: 0,
    };
  });
  const { count } = await prisma.quizAttempt.createMany({ data: rows, skipDuplicates: true });
  return count;
}

// ---------------------------------------------------------------------------
// Daily quiz pool, doubts, cohort, checkpoints, goal
// ---------------------------------------------------------------------------

const DAILY_POOL: [string, string[], number][] = [
  ["Which colour model is used for screens?", ["CMYK", "RGB", "Pantone", "RYB"], 1],
  [
    "A typeface without small strokes at the ends of letters is called…",
    ["Serif", "Sans-serif", "Script", "Blackletter"],
    1,
  ],
  ["The golden ratio is approximately…", ["1.414", "1.618", "2.718", "3.142"], 1],
  ["Which of these is a warm colour?", ["Blue", "Teal", "Orange", "Violet"], 2],
  [
    "A drawing showing an object from directly above is a…",
    ["Elevation", "Section", "Plan", "Perspective"],
    2,
  ],
  [
    "Which art movement is known for dream-like imagery?",
    ["Cubism", "Surrealism", "Minimalism", "Pop Art"],
    1,
  ],
  [
    "In photography, a smaller f-number means a…",
    ["Smaller aperture", "Wider aperture", "Faster shutter", "Lower ISO"],
    1,
  ],
  [
    "Kalamkari is a traditional craft of…",
    ["Hand-painted textiles", "Pottery", "Metal casting", "Stone carving"],
    0,
  ],
  [
    "Complementary colours sit…",
    ["Next to each other", "Opposite each other", "In the same row", "Nowhere on the wheel"],
    1,
  ],
  ["Which unit measures screen resolution density?", ["Lux", "PPI", "Hertz", "Lumen"], 1],
  [
    "A perspective drawing with two vanishing points is…",
    ["One-point", "Two-point", "Three-point", "Isometric"],
    1,
  ],
  ["Which material is a thermoplastic?", ["Oak", "Granite", "Polypropylene", "Clay"], 2],
  ["Which of these is a primary colour in light?", ["Yellow", "Green", "Magenta", "Cyan"], 1],
  ["Bauhaus was a school of…", ["Music", "Design and architecture", "Medicine", "Law"], 1],
  ["Isometric drawings use angles of…", ["30°", "45°", "60°", "90°"], 0],
];

async function seedDailyPool(prisma: PrismaClient, adminId: string): Promise<void> {
  const gk = sid("subject:general-knowledge");
  for (const [i, [text, options, correct]] of DAILY_POOL.entries()) {
    const id = sid(`question:daily/${i}`);
    if (await prisma.question.findUnique({ where: { id }, select: { id: true } })) continue;
    await prisma.question.create({
      data: {
        id,
        subjectId: gk,
        type: "SINGLE_CHOICE",
        difficulty: "EASY",
        text,
        tags: ["daily"],
        status: "PUBLISHED",
        createdById: adminId,
        options: {
          create: options.map((t, o) => ({
            id: sid(`option:daily/${i}/${o}`),
            text: t,
            isCorrect: o === correct,
            position: o,
          })),
        },
      },
    });
  }
}

async function seedCommunityExtras(
  prisma: PrismaClient,
  studentId: string,
  mentorId: string,
): Promise<void> {
  const questionId = qid("clock-puzzles", 2);
  const doubtId = sid("doubt:clock-2");
  if (!(await prisma.questionDoubt.findUnique({ where: { id: doubtId }, select: { id: true } }))) {
    await prisma.questionDoubt.create({
      data: {
        id: doubtId,
        questionId,
        userId: studentId,
        body: "Why do we multiply the minutes by 5.5 and not 6?",
      },
    });
    await prisma.questionDoubt.create({
      data: {
        id: sid("doubt:clock-2/reply"),
        questionId,
        userId: mentorId,
        parentId: doubtId,
        body: "The minute hand moves 6° a minute, but the hour hand also moves 0.5°, so they separate at 5.5° a minute.",
      },
    });
    await prisma.doubtClap.createMany({
      data: [{ doubtId, userId: mentorId }],
      skipDuplicates: true,
    });
  }

  const cohortId = sid("cohort:2026-online");
  await prisma.cohort.upsert({
    where: { id: cohortId },
    update: {},
    create: { id: cohortId, name: "2026 NID UCEED – Online", batch: "Online" },
  });
  await prisma.cohortMember.createMany({
    data: [{ cohortId, userId: studentId }],
    skipDuplicates: true,
  });

  const checkpoints: [string, number][] = [
    ["Finish Mental Ability lessons", 20],
    ["Take Mock Test 1", 35],
    ["Upload three practice sketches", 60],
  ];
  for (const [i, [title, days]] of checkpoints.entries()) {
    const id = sid(`checkpoint:${i}`);
    await prisma.courseCheckpoint.upsert({
      where: { id },
      update: {},
      create: {
        id,
        courseId,
        title,
        position: i,
        dueDate: new Date(Date.now() + days * 86_400_000),
      },
    });
  }
  await prisma.checkpointCompletion.createMany({
    data: [{ checkpointId: sid("checkpoint:1"), userId: studentId }],
    skipDuplicates: true,
  });
  await prisma.studentGoal.upsert({
    where: { userId_courseId: { userId: studentId, courseId } },
    update: {},
    create: { userId: studentId, courseId, targetPercent: 75, note: "Aim for the top 10%" },
  });
  await prisma.user.update({ where: { id: studentId }, data: { examYear: 2027 } });
}

// ---------------------------------------------------------------------------
// Colleges & webinars (fictional)
// ---------------------------------------------------------------------------

const COLLEGES: {
  name: string;
  city: string;
  categories: string[];
  fee: number | null;
  about: string;
}[] = [
  {
    name: "Northfield School of Design",
    city: "Pune",
    categories: ["DESIGN"],
    fee: 2000,
    about: "Four-year B.Des in product, communication and interaction design.",
  },
  {
    name: "Riverside Institute of Architecture",
    city: "Bengaluru",
    categories: ["ARCHITECTURE"],
    fee: 1500,
    about: "Five-year B.Arch with a strong studio and site-visit programme.",
  },
  {
    name: "Lotus College of Fashion",
    city: "New Delhi",
    categories: ["FASHION", "DESIGN"],
    fee: 2500,
    about: "Fashion design, textiles and accessories, with an industry internship.",
  },
  {
    name: "Coastal Academy of Art & Design",
    city: "Kochi",
    categories: ["DESIGN"],
    fee: null,
    about: "Small batches in illustration, animation and visual communication.",
  },
  {
    name: "Highland School of Planning",
    city: "Dehradun",
    categories: ["ARCHITECTURE"],
    fee: 1000,
    about: "B.Arch and B.Plan programmes focused on sustainable cities.",
  },
  {
    name: "Meridian Design University",
    city: "Ahmedabad",
    categories: ["DESIGN", "FASHION"],
    fee: 3000,
    about: "Multi-disciplinary design university with open electives.",
  },
  {
    name: "Harbourview International College",
    city: "Singapore",
    categories: ["STUDY_ABROAD", "DESIGN"],
    fee: null,
    about: "Design foundation and degree pathways for international students.",
  },
  {
    name: "Sunrise Institute of Spatial Design",
    city: "Hyderabad",
    categories: ["ARCHITECTURE", "DESIGN"],
    fee: 1800,
    about: "Interior and spatial design with a focus on making.",
  },
];

async function seedColleges(prisma: PrismaClient): Promise<void> {
  for (const [i, c] of COLLEGES.entries()) {
    const slug = c.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    await prisma.college.upsert({
      where: { slug },
      update: {},
      create: {
        id: sid(`college:${slug}`),
        name: c.name,
        slug,
        city: c.city,
        categories: c.categories,
        applicationFee: c.fee,
        description: `${c.about}\n\n## Courses\n\n- Undergraduate degree (4–5 years)\n- Foundation year\n\n## Eligibility\n\nClass 12 in any stream; admission through an entrance test and portfolio review.\n\n*Sample college for testing.*`,
        position: i,
      },
    });
  }
  const now = Date.now();
  const webinars = [
    {
      title: "Meet Northfield School of Design",
      college: "northfield-school-of-design",
      inDays: 5,
    },
    {
      title: "Inside an architecture studio: Riverside",
      college: "riverside-institute-of-architecture",
      inDays: 12,
    },
  ];
  for (const w of webinars) {
    const slug = w.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const startsAt = new Date(now + w.inDays * 86_400_000);
    startsAt.setUTCHours(11, 30, 0, 0);
    await prisma.webinar.upsert({
      where: { slug },
      update: {},
      create: {
        id: sid(`webinar:${slug}`),
        collegeId: sid(`college:${w.college}`),
        title: w.title,
        slug,
        description:
          "Faculty and students talk about the programme, the admission process and campus life. Bring your questions.\n\n*Sample webinar for testing.*",
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60_000),
        joinUrl: "https://meet.example.com/examora-sample",
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Questions inside the Puzzles "Examples" lesson (answered inline)
// ---------------------------------------------------------------------------

async function seedLessonQuestions(prisma: PrismaClient): Promise<number> {
  const lessonId = sid("lesson:mental-ability/puzzles/examples");
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lesson) return 0;
  const picks: [string, number][] = [
    ["clock-puzzles", 0],
    ["number-puzzles", 0],
    ["puzzles-review", 0],
    ["rotation-practice", 2],
    ["rotation-practice", 3],
  ];
  const found = await prisma.question.findMany({
    where: { id: { in: picks.map(([q, i]) => qid(q, i)) }, type: { not: "UPLOAD" } },
    select: { id: true },
  });
  const present = new Set(found.map((q) => q.id));
  const data = picks
    .map(([q, i]) => qid(q, i))
    .filter((id) => present.has(id))
    .map((questionId, position) => ({
      id: sid(`lesson-question:examples/${questionId}`),
      lessonId,
      questionId,
      position,
    }));
  await prisma.lessonQuestion.createMany({ data, skipDuplicates: true });
  return data.length;
}

/** Two expert comments pinned to the demo student's reviewed sketch. */
async function seedSketchPins(
  prisma: PrismaClient,
  studentId: string,
  mentorId: string,
): Promise<void> {
  const answer = await prisma.quizAttemptAnswer.findFirst({
    where: {
      uploadAssetId: { not: null },
      attempt: { userId: studentId },
      sketchReview: { isNot: null },
    },
    select: { id: true },
  });
  if (!answer) return;
  const pins = [
    { key: "horizon", x: 0.62, y: 0.28, body: "The horizon tilts slightly here; keep it level." },
    {
      key: "figure",
      x: 0.35,
      y: 0.66,
      body: "Good weight on this figure. Add a shadow to ground it.",
    },
  ];
  for (const p of pins) {
    const id = sid(`sketch-comment:demo/${p.key}`);
    await prisma.sketchComment.upsert({
      where: { id },
      create: { id, answerId: answer.id, authorId: mentorId, x: p.x, y: p.y, body: p.body },
      update: {},
    });
  }
}

export async function seedPracticeAndExtras(
  prisma: PrismaClient,
  ids: { studentId: string; adminId: string; mentorId: string },
): Promise<string> {
  await linkQuestionTopics(prisma);
  await seedPracticeTests(prisma, ids.adminId);
  await seedDemoAttempt(prisma, ids.studentId, ids.adminId);
  const ranked = await seedRankingAttempts(prisma);
  await seedDailyPool(prisma, ids.adminId);
  await seedCommunityExtras(prisma, ids.studentId, ids.mentorId);
  await seedColleges(prisma);
  const inLesson = await seedLessonQuestions(prisma);
  await seedSketchPins(prisma, ids.studentId, ids.mentorId);
  return `practice tests, demo report, ${ranked} ranking attempts, daily pool, colleges & webinars, ${inLesson} lesson questions`;
}
