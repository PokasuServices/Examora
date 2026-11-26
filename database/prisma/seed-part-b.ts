import type { Prisma, PrismaClient } from "../generated/client/index.js";

/**
 * Practice papers split into Part A (the timed test) and Part B (sketching,
 * untimed, in the paper's Part B tab). This step keeps existing data in line:
 *
 * 1. Sketches uploaded inside practice-test attempts become Part B originals,
 *    carrying their self and reviewer ratings and positional comments.
 * 2. Those questions leave the attempt, and its Part A score is recounted.
 * 3. Every practice paper with sketching gets at least two Part B questions.
 *
 * Safe to run again: attempts already split are skipped.
 */

const n = (d: Prisma.Decimal | number | null | undefined) => (d == null ? 0 : Number(d));
const round2 = (x: number) => Math.round(x * 100) / 100;

type SnapshotRow = { questionId: string; sectionId: string | null; marks: number };

async function moveAnswerToPartB(
  prisma: PrismaClient,
  userId: string,
  answer: {
    id: string;
    questionId: string;
    uploadAssetId: string | null;
    answeredAt: Date | null;
    sketchVersion: { id: string } | null;
    sketchReview: {
      selfScores: Prisma.JsonValue;
      selfRatedAt: Date | null;
      expertScores: Prisma.JsonValue;
      expertComment: string | null;
      expertId: string | null;
      expertReviewedAt: Date | null;
    } | null;
  },
): Promise<void> {
  let versionId = answer.sketchVersion?.id ?? null;
  if (!versionId && answer.uploadAssetId) {
    const work = await prisma.sketchWork.upsert({
      where: { userId_questionId: { userId, questionId: answer.questionId } },
      create: { userId, questionId: answer.questionId },
      update: {},
      select: { id: true, _count: { select: { versions: { where: { deletedAt: null } } } } },
    });
    // Already has a Part B original: the in-test copy isn't needed.
    if (work._count.versions === 0) {
      versionId = (
        await prisma.sketchVersion.create({
          data: {
            workId: work.id,
            kind: "TEST",
            assetId: answer.uploadAssetId,
            ...(answer.answeredAt ? { createdAt: answer.answeredAt } : {}),
          },
          select: { id: true },
        })
      ).id;
    }
  }
  if (!versionId) return;

  const r = answer.sketchReview;
  if (r?.selfRatedAt && r.selfScores) {
    await prisma.sketchVersionRating.upsert({
      where: { versionId_raterId: { versionId, raterId: userId } },
      create: {
        versionId,
        raterId: userId,
        kind: "SELF",
        scores: r.selfScores as Prisma.InputJsonValue,
        createdAt: r.selfRatedAt,
      },
      update: {},
    });
  }
  if (r?.expertReviewedAt && r.expertScores && r.expertId) {
    await prisma.sketchVersionRating.upsert({
      where: { versionId_raterId: { versionId, raterId: r.expertId } },
      create: {
        versionId,
        raterId: r.expertId,
        kind: "EXPERT",
        scores: r.expertScores as Prisma.InputJsonValue,
        comment: r.expertComment,
        createdAt: r.expertReviewedAt,
      },
      update: {},
    });
  }
  // Positional comments on the test upload move onto the version.
  await prisma.sketchComment.updateMany({
    where: { answerId: answer.id },
    data: { versionId, answerId: null },
  });
  await prisma.sketchVersion.update({ where: { id: versionId }, data: { answerId: null } });
}

/** Moves in-test sketches of practice papers to Part B and recounts Part A scores. */
export async function splitPartB(prisma: PrismaClient): Promise<number> {
  const uploadIds = new Set(
    (await prisma.question.findMany({ where: { type: "UPLOAD" }, select: { id: true } })).map(
      (q) => q.id,
    ),
  );
  const attempts = await prisma.quizAttempt.findMany({
    where: { quiz: { practiceCategoryId: { not: null } } },
    select: {
      id: true,
      userId: true,
      status: true,
      questionSnapshot: true,
      totalMarks: true,
      obtainedMarks: true,
      passingScorePercent: true,
      correctCount: true,
      wrongCount: true,
      unansweredCount: true,
    },
  });
  let split = 0;
  for (const a of attempts) {
    const snap = (a.questionSnapshot ?? []) as unknown as SnapshotRow[];
    const partB = snap.filter((s) => uploadIds.has(s.questionId));
    if (partB.length === 0) continue;
    const answers = await prisma.quizAttemptAnswer.findMany({
      where: { attemptId: a.id, questionId: { in: partB.map((s) => s.questionId) } },
      select: {
        id: true,
        questionId: true,
        uploadAssetId: true,
        answeredAt: true,
        isCorrect: true,
        marksAwarded: true,
        sketchVersion: { select: { id: true } },
        sketchReview: {
          select: {
            selfScores: true,
            selfRatedAt: true,
            expertScores: true,
            expertComment: true,
            expertId: true,
            expertReviewedAt: true,
          },
        },
      },
    });
    for (const ans of answers) await moveAnswerToPartB(prisma, a.userId, ans);

    const removedMarks = partB.reduce((t, s) => t + s.marks, 0);
    const removedObtained = answers.reduce((t, x) => t + n(x.marksAwarded), 0);
    const answered = new Set(answers.filter((x) => x.uploadAssetId).map((x) => x.questionId));
    const total = round2(Math.max(0, n(a.totalMarks) - removedMarks));
    const obtained =
      a.obtainedMarks === null
        ? null
        : round2(Math.min(total, Math.max(0, n(a.obtainedMarks) - removedObtained)));
    const finished = a.status !== "IN_PROGRESS";
    await prisma.quizAttemptAnswer.deleteMany({
      where: { id: { in: answers.map((x) => x.id) } },
    });
    await prisma.quizAttempt.update({
      where: { id: a.id },
      data: {
        questionSnapshot: snap.filter(
          (s) => !uploadIds.has(s.questionId),
        ) as unknown as Prisma.InputJsonValue,
        totalMarks: total,
        ...(finished && obtained !== null
          ? {
              obtainedMarks: obtained,
              percentage: total > 0 ? round2((obtained / total) * 100) : 0,
              passed: total > 0 && (obtained / total) * 100 >= n(a.passingScorePercent),
              correctCount: Math.max(
                0,
                (a.correctCount ?? 0) - answers.filter((x) => x.isCorrect === true).length,
              ),
              wrongCount: Math.max(
                0,
                (a.wrongCount ?? 0) - answers.filter((x) => x.isCorrect === false).length,
              ),
              unansweredCount: Math.max(
                0,
                (a.unansweredCount ?? 0) - partB.filter((s) => !answered.has(s.questionId)).length,
              ),
            }
          : {}),
      },
    });
    split++;
  }
  return split;
}

/** Second sketch for papers that have only one, so Part B always shows question tabs. */
export async function ensureTwoSketches(prisma: PrismaClient, pool: string[]): Promise<number> {
  const quizzes = await prisma.quiz.findMany({
    where: {
      deletedAt: null,
      practiceCategoryId: { not: null },
      quizQuestions: { some: { question: { type: "UPLOAD" } } },
    },
    select: {
      id: true,
      quizQuestions: {
        orderBy: { position: "asc" },
        select: {
          questionId: true,
          sectionId: true,
          marks: true,
          position: true,
          question: { select: { type: true } },
        },
      },
    },
  });
  const available = new Set(
    (
      await prisma.question.findMany({
        where: { id: { in: pool }, type: "UPLOAD", deletedAt: null },
        select: { id: true },
      })
    ).map((q) => q.id),
  );
  let added = 0;
  for (const q of quizzes) {
    const sketches = q.quizQuestions.filter((qq) => qq.question.type === "UPLOAD");
    if (sketches.length >= 2) continue;
    const first = sketches[0]!;
    const pick = pool.find(
      (id) => available.has(id) && !q.quizQuestions.some((qq) => qq.questionId === id),
    );
    if (!pick) continue;
    const last = q.quizQuestions[q.quizQuestions.length - 1]!;
    await prisma.quizQuestion.create({
      data: {
        quizId: q.id,
        questionId: pick,
        sectionId: first.sectionId,
        marks: first.marks,
        position: last.position + 1,
      },
    });
    added++;
  }
  return added;
}
