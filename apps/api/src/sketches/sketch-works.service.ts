import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@examora/database";
import type {
  RubricFactor,
  SketchChallenge,
  SketchCommentView,
  SketchCommunityCard,
  SketchCommunityPage,
  SketchRatingResult,
  SketchReportView,
  SketchRevisionQueueItem,
  SketchRubricView,
  SketchVersionRatings,
  SketchVersionView,
  SketchWorkCommentView,
  SketchWorkView,
  SketchWorkspace,
  SketchWorkspaceQuestion,
} from "@examora/types";
import { toCriteria } from "../assessment/assessment.mappers";
import type { QuestionSnapshot } from "../assessment/quiz-attempts/attempt-snapshot.types";
import { shortName } from "../assessment/quiz-attempts/attempt-analysis.service";
import { CmsAssetScanQueueService } from "../cms/assets/cms-asset-scan-queue.service";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_PORT, type StoragePort } from "../storage/storage.port";
import { cleanScores, isSketchStaff } from "./sketches.service";

/** Uploads allowed per sketch, including the test upload. */
export const MAX_SKETCH_VERSIONS = 4;
export const SELF_RATING_XP = 10;
export const PEER_FEEDBACK_XP = 25;
/** XP-earning peer feedback per student per day (India time). */
export const PEER_FEEDBACK_DAILY_LIMIT = 10;
const COMMUNITY_PAGE_SIZE = 12;
const FINISHED = ["SUBMITTED", "AUTO_SUBMITTED"] as const;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const IST_OFFSET_MS = 330 * 60_000;

type Viewer = { id: string; roles: string[] };
type FactorInput = { title: string; description?: string | null };
type Scores = Record<string, number>;

/** A question's rating factors: its rubric when set, else its plain criteria. */
export function factorsOf(q: {
  criteria: Prisma.JsonValue | null;
  rubric: { title: string; factors: Prisma.JsonValue } | null;
}): { rubricTitle: string | null; factors: RubricFactor[] } {
  if (q.rubric) return { rubricTitle: q.rubric.title, factors: toFactors(q.rubric.factors) };
  return {
    rubricTitle: null,
    factors: toCriteria(q.criteria).map((title) => ({ title, description: null })),
  };
}

export function toFactors(json: Prisma.JsonValue | null): RubricFactor[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((f) =>
    f && typeof f === "object" && !Array.isArray(f) && typeof f.title === "string" && f.title.trim()
      ? [
          {
            title: f.title.trim(),
            description: typeof f.description === "string" ? f.description : null,
          },
        ]
      : [],
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 1–5 scores on the factors, scaled to the question's marks. */
export function scaledTotal(scores: Scores, factors: string[], maxMarks: number): number {
  if (factors.length === 0) return 0;
  const sum = factors.reduce((t, f) => t + (scores[f] ?? 0), 0);
  return round1((sum / (5 * factors.length)) * maxMarks);
}

/** Average per factor across several raters. */
export function averageScores(list: Scores[], factors: string[]): Scores {
  const out: Scores = {};
  for (const f of factors) {
    const vals = list.map((s) => s[f]).filter((v): v is number => typeof v === "number");
    if (vals.length) out[f] = round1(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return out;
}

/** Community score: average share of factors classmates liked, scaled to the marks. */
export function communityTotal(liked: string[][], factors: string[], maxMarks: number): number {
  if (liked.length === 0 || factors.length === 0) return 0;
  const set = new Set(factors);
  const avg =
    liked.reduce((t, l) => t + l.filter((f) => set.has(f)).length / factors.length, 0) /
    liked.length;
  return round1(avg * maxMarks);
}

/** Start of today in India, as an instant. */
export function startOfIndiaDay(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS,
  );
}

const PERSON = { select: { id: true, email: true, firstName: true, lastName: true } } as const;
const PERSON_WITH_ROLES = {
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    roles: { select: { role: { select: { name: true } } } },
  },
} as const;
const nameOf = (u: { firstName: string | null; lastName: string | null; email: string }) =>
  shortName(u.firstName, u.lastName, u.email);

const WORK_INCLUDE = {
  user: PERSON,
  question: {
    select: {
      text: true,
      criteria: true,
      rubric: { select: { title: true, factors: true } },
      quizQuestions: { select: { marks: true }, orderBy: { marks: "desc" }, take: 1 },
    },
  },
  versions: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      answer: {
        select: {
          marksAwarded: true,
          questionId: true,
          sketchReview: {
            select: {
              selfScores: true,
              selfRatedAt: true,
              expertScores: true,
              expertComment: true,
              expertReviewedAt: true,
              expert: PERSON,
            },
          },
          attempt: { select: { questionSnapshot: true } },
        },
      },
      ratings: { include: { rater: PERSON } },
      peerFeedback: { orderBy: { createdAt: "desc" }, include: { rater: PERSON } },
      _count: { select: { pins: { where: { deletedAt: null } } } },
    },
  },
  comments: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { author: PERSON_WITH_ROLES },
  },
  _count: { select: { views: true, claps: true } },
} satisfies Prisma.SketchWorkInclude;

type WorkRow = Prisma.SketchWorkGetPayload<{ include: typeof WORK_INCLUDE }>;
type VersionRow = WorkRow["versions"][number];

/**
 * Practice sketch workspace: after a test, each sketch question opens as a
 * "work" holding the test upload plus revisions (max 4 uploads), with pins,
 * claps, views, comments, abuse reports, ratings and peer feedback.
 * Revisions never change the test score; that stays on the test upload's
 * expert marks (Sketch review).
 */
@Injectable()
export class SketchWorksService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly scanQueue: CmsAssetScanQueueService,
    private readonly xp: XpService,
  ) {}

  // ------------------------------------------------------------ building views

  /** Creates works/test versions for finished test uploads that don't have one yet. */
  private async ensureWorks(userId: string, questionIds?: string[]): Promise<void> {
    const answers = await this.prisma.quizAttemptAnswer.findMany({
      where: {
        uploadAssetId: { not: null },
        sketchVersion: null,
        attempt: { userId, status: { in: [...FINISHED] } },
        ...(questionIds ? { questionId: { in: questionIds } } : {}),
      },
      select: { id: true, questionId: true, uploadAssetId: true, answeredAt: true },
      orderBy: { answeredAt: "asc" },
    });
    for (const a of answers) {
      const work = await this.prisma.sketchWork.upsert({
        where: { userId_questionId: { userId, questionId: a.questionId } },
        create: { userId, questionId: a.questionId },
        update: {},
        select: { id: true },
      });
      await this.prisma.sketchVersion
        .create({
          data: {
            workId: work.id,
            kind: "TEST",
            answerId: a.id,
            assetId: a.uploadAssetId!,
            ...(a.answeredAt ? { createdAt: a.answeredAt } : {}),
          },
        })
        .catch((err: { code?: string }) => {
          if (err.code !== "P2002") throw err;
        });
    }
  }

  private maxMarksOf(row: WorkRow): number {
    for (const v of row.versions) {
      const snap = (v.answer?.attempt.questionSnapshot ?? []) as unknown as QuestionSnapshot;
      const m = snap.find((s) => s.questionId === row.questionId)?.marks;
      if (m) return m;
    }
    const qq = row.question.quizQuestions[0];
    return qq ? Number(qq.marks) : 10;
  }

  private ratingsOf(
    v: VersionRow,
    row: WorkRow,
    viewer: Viewer,
    factorTitles: string[],
    maxMarks: number,
  ): SketchVersionRatings {
    const review = v.answer?.sketchReview ?? null;
    const selfRow = v.ratings.find((r) => r.kind === "SELF");
    const selfScores =
      (selfRow?.scores as Scores | undefined) ??
      (v.kind === "TEST" && review?.selfRatedAt ? (review.selfScores as Scores | null) : null) ??
      null;

    const expertRows = v.ratings.filter((r) => r.kind === "EXPERT");
    const expertList: { scores: Scores; comment: string | null; name: string; at: Date }[] =
      expertRows.map((r) => ({
        scores: r.scores as Scores,
        comment: r.comment,
        name: nameOf(r.rater),
        at: r.updatedAt,
      }));
    if (v.kind === "TEST" && review?.expertReviewedAt && review.expertScores) {
      expertList.unshift({
        scores: review.expertScores as Scores,
        comment: review.expertComment,
        name: review.expert ? nameOf(review.expert) : "Reviewer",
        at: review.expertReviewedAt,
      });
    }
    const expertAvg = averageScores(
      expertList.map((e) => e.scores),
      factorTitles,
    );
    const testMarks =
      v.kind === "TEST" && review?.expertReviewedAt && v.answer?.marksAwarded != null
        ? Number(v.answer.marksAwarded)
        : null;

    const feedback = v.peerFeedback;
    const likes: Record<string, number> = {};
    for (const f of factorTitles) likes[f] = 0;
    for (const fb of feedback) {
      for (const f of fb.likedFactors) if (f in likes) likes[f] = (likes[f] ?? 0) + 1;
    }
    const mine = feedback.find((fb) => fb.raterId === viewer.id);

    return {
      self: selfScores
        ? { scores: selfScores, total: scaledTotal(selfScores, factorTitles, maxMarks) }
        : null,
      expert:
        expertList.length > 0
          ? {
              scores: expertAvg,
              total: testMarks ?? scaledTotal(expertAvg, factorTitles, maxMarks),
              count: expertList.length,
              comments: expertList
                .filter((e) => e.comment)
                .map((e) => ({
                  authorName: e.name,
                  body: e.comment!,
                  createdAt: e.at.toISOString(),
                })),
            }
          : null,
      community: {
        count: feedback.length,
        likes,
        total: communityTotal(
          feedback.map((fb) => fb.likedFactors),
          factorTitles,
          maxMarks,
        ),
        comments: feedback
          .filter((fb) => fb.comment)
          .map((fb) => ({
            authorName: nameOf(fb.rater),
            body: fb.comment!,
            likedFactors: fb.likedFactors,
            createdAt: fb.createdAt.toISOString(),
          })),
      },
      myFeedback:
        row.userId !== viewer.id && mine
          ? { likedFactors: mine.likedFactors, comment: mine.comment }
          : null,
    };
  }

  private toWorkView(
    row: WorkRow,
    viewer: Viewer,
    clapped: boolean,
    reported: boolean,
  ): SketchWorkView {
    const isMine = row.userId === viewer.id;
    const { rubricTitle, factors } = factorsOf(row.question);
    const factorTitles = factors.map((f) => f.title);
    const maxMarks = this.maxMarksOf(row);
    let revision = 0;
    const versions: SketchVersionView[] = row.versions.map((v) => {
      const reviewed = v.answer?.sketchReview?.expertReviewedAt != null;
      return {
        id: v.id,
        kind: v.kind,
        label: v.kind === "TEST" ? "Test upload" : `Revision ${++revision}`,
        imageRef: `media:${v.assetId}`,
        description: v.description,
        createdAt: v.createdAt.toISOString(),
        pinCount: v._count.pins,
        canDelete: isMine && v.kind === "REVISION",
        expert:
          v.kind === "TEST" && v.answer
            ? {
                marks:
                  reviewed && v.answer.marksAwarded !== null ? Number(v.answer.marksAwarded) : null,
                maxMarks,
                comment: v.answer.sketchReview?.expertComment ?? null,
              }
            : null,
        ratings: this.ratingsOf(v, row, viewer, factorTitles, maxMarks),
      };
    });
    const comments: SketchWorkCommentView[] = row.comments.map((c) => {
      const roles = c.author.roles.map((r) => r.role.name);
      return {
        id: c.id,
        body: c.body,
        authorName: nameOf(c.author),
        authorKind: c.author.id === row.userId ? "OWNER" : isSketchStaff(roles) ? "EXPERT" : "PEER",
        mine: c.author.id === viewer.id,
        createdAt: c.createdAt.toISOString(),
      };
    });
    return {
      id: row.id,
      questionId: row.questionId,
      questionText: row.question.text,
      rubricTitle,
      factors,
      maxMarks,
      ownerName: nameOf(row.user),
      isMine,
      versions,
      maxVersions: MAX_SKETCH_VERSIONS,
      canUpload: isMine && versions.length < MAX_SKETCH_VERSIONS,
      views: row._count.views,
      claps: row._count.claps,
      clappedByMe: clapped,
      reportedByMe: reported,
      comments,
    };
  }

  private async loadWork(workId: string, viewer: Viewer): Promise<SketchWorkView> {
    const row = await this.prisma.sketchWork.findUnique({
      where: { id: workId },
      include: WORK_INCLUDE,
    });
    if (!row) throw new NotFoundException("Sketch not found");
    const [clap, report] = await Promise.all([
      this.prisma.sketchClap.findUnique({
        where: { workId_userId: { workId, userId: viewer.id } },
        select: { workId: true },
      }),
      this.prisma.sketchReport.findUnique({
        where: { workId_reporterId: { workId, reporterId: viewer.id } },
        select: { id: true },
      }),
    ]);
    return this.toWorkView(row, viewer, Boolean(clap), Boolean(report));
  }

  /** Has the student rated their own sketch (any version) for this question? */
  private async hasSelfRated(userId: string, questionId: string): Promise<boolean> {
    const [rated, legacy] = await Promise.all([
      this.prisma.sketchVersionRating.findFirst({
        where: { kind: "SELF", raterId: userId, version: { work: { userId, questionId } } },
        select: { id: true },
      }),
      this.prisma.sketchReview.findFirst({
        where: { selfRatedAt: { not: null }, answer: { questionId, attempt: { userId } } },
        select: { id: true },
      }),
    ]);
    return Boolean(rated || legacy);
  }

  /** Owner, staff, or a student who has uploaded and rated their own sketch for the question. */
  private async assertCanView(viewer: Viewer, work: { userId: string; questionId: string }) {
    if (work.userId === viewer.id || isSketchStaff(viewer.roles)) return;
    if (!(await this.hasSelfRated(viewer.id, work.questionId))) {
      throw new ForbiddenException("Upload and rate your own sketch first to see others' work");
    }
  }

  private async workFor(viewer: Viewer, workId: string) {
    const work = await this.prisma.sketchWork.findUnique({
      where: { id: workId },
      select: { id: true, userId: true, questionId: true },
    });
    if (!work) throw new NotFoundException("Sketch not found");
    await this.assertCanView(viewer, work);
    return work;
  }

  // ------------------------------------------------------------ reading

  /** The sketch questions of a test with the student's work on each. */
  async workspaceForTest(viewer: Viewer, quizId: string): Promise<SketchWorkspace> {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: quizId, deletedAt: null },
      select: {
        id: true,
        title: true,
        quizQuestions: {
          where: { question: { type: "UPLOAD", deletedAt: null } },
          orderBy: { position: "asc" },
          select: {
            marks: true,
            section: { select: { title: true } },
            question: {
              select: {
                id: true,
                text: true,
                criteria: true,
                rubric: { select: { title: true, factors: true } },
              },
            },
          },
        },
      },
    });
    if (!quiz) throw new NotFoundException("Test not found");
    const finished = Boolean(
      await this.prisma.quizAttempt.findFirst({
        where: { quizId, userId: viewer.id, status: { in: [...FINISHED] } },
        select: { id: true },
      }),
    );
    const questionIds = quiz.quizQuestions.map((qq) => qq.question.id);
    if (finished) await this.ensureWorks(viewer.id, questionIds);
    const works = await this.prisma.sketchWork.findMany({
      where: { userId: viewer.id, questionId: { in: questionIds } },
      select: { id: true, questionId: true },
    });
    const workBy = new Map(works.map((w) => [w.questionId, w.id]));
    const questions: SketchWorkspaceQuestion[] = [];
    for (const qq of quiz.quizQuestions) {
      const workId = workBy.get(qq.question.id);
      const work = workId ? await this.loadWork(workId, viewer) : null;
      questions.push({
        questionId: qq.question.id,
        text: qq.question.text,
        marks: Number(qq.marks),
        sectionTitle: qq.section?.title ?? null,
        ...factorsOf(qq.question),
        work,
        canUpload: finished && (work ? work.canUpload : true),
      });
    }
    return {
      quiz: { id: quiz.id, title: quiz.title },
      finished,
      maxVersions: MAX_SKETCH_VERSIONS,
      questions,
    };
  }

  /** One work (own, or another student's when allowed); counts a view for others. */
  async getWork(viewer: Viewer, workId: string): Promise<SketchWorkView> {
    const work = await this.workFor(viewer, workId);
    if (work.userId !== viewer.id) {
      await this.prisma.sketchWorkView
        .create({ data: { workId, viewerId: viewer.id } })
        .catch((err: { code?: string }) => {
          if (err.code !== "P2002") throw err;
        });
    }
    return this.loadWork(workId, viewer);
  }

  // ------------------------------------------------------------ ratings

  private async versionWithWork(versionId: string) {
    const v = await this.prisma.sketchVersion.findFirst({
      where: { id: versionId, deletedAt: null },
      select: {
        id: true,
        kind: true,
        answerId: true,
        workId: true,
        work: {
          select: {
            userId: true,
            questionId: true,
            question: {
              select: { criteria: true, rubric: { select: { title: true, factors: true } } },
            },
          },
        },
        answer: { select: { sketchReview: { select: { selfRatedAt: true } } } },
      },
    });
    if (!v) throw new NotFoundException("Sketch version not found");
    return v;
  }

  /** Rate your own version, 1–5 per factor. Once per version; it can't be changed afterwards. */
  async rateSelf(userId: string, versionId: string, scores: Scores): Promise<SketchRatingResult> {
    const v = await this.versionWithWork(versionId);
    if (v.work.userId !== userId) throw new NotFoundException("Sketch version not found");
    const factors = factorsOf(v.work.question).factors.map((f) => f.title);
    const clean = cleanScores(factors, scores);
    const existing = await this.prisma.sketchVersionRating.findFirst({
      where: { versionId, kind: "SELF" },
      select: { id: true },
    });
    if (existing || (v.kind === "TEST" && v.answer?.sketchReview?.selfRatedAt)) {
      throw new ConflictException("You've already rated this version. Ratings can't be changed.");
    }
    await this.prisma.sketchVersionRating.create({
      data: { versionId, raterId: userId, kind: "SELF", scores: clean },
    });
    // The test upload's rating also lives on its review (used by Sketch review and the old gallery).
    if (v.kind === "TEST" && v.answerId) {
      await this.prisma.sketchReview.upsert({
        where: { answerId: v.answerId },
        create: { answerId: v.answerId, selfScores: clean, selfRatedAt: new Date() },
        update: { selfScores: clean, selfRatedAt: new Date() },
      });
    }
    const awarded = await this.xp.award({
      userId,
      amount: SELF_RATING_XP,
      reason: "SKETCH_SELF_RATING",
      sourceType: "SketchVersion",
      sourceId: versionId,
    });
    return {
      work: await this.loadWork(v.workId, { id: userId, roles: [] }),
      xpAwarded: awarded ? SELF_RATING_XP : 0,
    };
  }

  /**
   * A classmate's feedback on one version: the factors they liked plus an
   * optional comment. Once per version. Earns XP when at least one factor is
   * ticked, for the first 10 feedbacks of the day.
   */
  async peerFeedback(
    viewer: Viewer,
    versionId: string,
    input: { likedFactors: string[]; comment?: string | null },
  ): Promise<SketchRatingResult> {
    const v = await this.versionWithWork(versionId);
    if (v.work.userId === viewer.id) {
      throw new BadRequestException("Rate your own sketch with self-rating");
    }
    await this.assertCanView(viewer, v.work);
    const factors = new Set(factorsOf(v.work.question).factors.map((f) => f.title));
    const liked = [...new Set(input.likedFactors)];
    if (liked.some((f) => !factors.has(f))) {
      throw new BadRequestException("Pick factors from this question's list");
    }
    const comment = input.comment?.trim() || null;
    if (liked.length === 0 && !comment) {
      throw new BadRequestException("Tick at least one factor you liked, or write a comment");
    }
    const earnedToday = await this.prisma.sketchPeerFeedback.count({
      where: { raterId: viewer.id, xpAwarded: true, createdAt: { gte: startOfIndiaDay() } },
    });
    const earns = liked.length > 0 && earnedToday < PEER_FEEDBACK_DAILY_LIMIT;
    let created: { id: string };
    try {
      created = await this.prisma.sketchPeerFeedback.create({
        data: { versionId, raterId: viewer.id, likedFactors: liked, comment, xpAwarded: earns },
        select: { id: true },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        throw new ConflictException("You've already given feedback on this version");
      }
      throw err;
    }
    let xpAwarded = 0;
    if (earns) {
      const ok = await this.xp.award({
        userId: viewer.id,
        amount: PEER_FEEDBACK_XP,
        reason: "SKETCH_PEER_FEEDBACK",
        sourceType: "SketchPeerFeedback",
        sourceId: created.id,
      });
      xpAwarded = ok ? PEER_FEEDBACK_XP : 0;
    }
    return {
      work: await this.loadWork(v.workId, viewer),
      xpAwarded,
      peerXpLeftToday: Math.max(0, PEER_FEEDBACK_DAILY_LIMIT - earnedToday - (earns ? 1 : 0)),
    };
  }

  /** Reviewer feedback on a revision (the test upload is marked in Sketch review). */
  async expertRate(
    staff: Viewer,
    versionId: string,
    input: { scores: Scores; comment?: string | null },
  ): Promise<void> {
    if (!isSketchStaff(staff.roles)) throw new ForbiddenException("Reviewers only");
    const v = await this.versionWithWork(versionId);
    if (v.kind === "TEST") {
      throw new BadRequestException(
        "Mark the test upload in Sketch review (it sets the test score)",
      );
    }
    const clean = cleanScores(
      factorsOf(v.work.question).factors.map((f) => f.title),
      input.scores,
    );
    const comment = input.comment?.trim() || null;
    await this.prisma.sketchVersionRating.upsert({
      where: { versionId_raterId: { versionId, raterId: staff.id } },
      create: { versionId, raterId: staff.id, kind: "EXPERT", scores: clean, comment },
      update: { scores: clean, comment },
    });
  }

  async revisionQueue(
    staff: Viewer,
    status: "pending" | "reviewed",
  ): Promise<SketchRevisionQueueItem[]> {
    const rows = await this.prisma.sketchVersion.findMany({
      where: {
        kind: "REVISION",
        deletedAt: null,
        ratings: status === "pending" ? { none: { kind: "EXPERT" } } : { some: { kind: "EXPERT" } },
      },
      orderBy: { createdAt: status === "pending" ? "asc" : "desc" },
      take: 100,
      include: {
        work: {
          select: {
            id: true,
            user: PERSON,
            question: {
              select: {
                text: true,
                criteria: true,
                rubric: { select: { title: true, factors: true } },
              },
            },
            versions: {
              where: { deletedAt: null },
              orderBy: { createdAt: "asc" },
              select: { id: true, kind: true },
            },
          },
        },
        ratings: { where: { raterId: staff.id, kind: "EXPERT" } },
      },
    });
    return rows.map((v) => {
      const revisions = v.work.versions.filter((x) => x.kind === "REVISION");
      const n = revisions.findIndex((x) => x.id === v.id) + 1;
      const mine = v.ratings[0];
      return {
        versionId: v.id,
        workId: v.work.id,
        studentName: nameOf(v.work.user),
        questionText: v.work.question.text,
        label: `Revision ${n}`,
        imageRef: `media:${v.assetId}`,
        description: v.description,
        factors: factorsOf(v.work.question).factors,
        createdAt: v.createdAt.toISOString(),
        myScores: (mine?.scores as Scores | undefined) ?? null,
        myComment: mine?.comment ?? null,
      };
    });
  }

  // ------------------------------------------------------------ community

  /** Classmates' latest versions for a question (after the viewer has rated their own). */
  async community(
    viewer: Viewer,
    questionId: string,
    opts: { sort: "newest" | "claps" | "top"; filter: "all" | "unrated" | "rated"; page: number },
  ): Promise<SketchCommunityPage> {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, type: "UPLOAD", deletedAt: null },
      select: { quizQuestions: { select: { marks: true }, orderBy: { marks: "desc" }, take: 1 } },
    });
    if (!question) throw new NotFoundException("Sketch question not found");
    const maxMarks = question.quizQuestions[0] ? Number(question.quizQuestions[0].marks) : 10;
    const unlocked =
      isSketchStaff(viewer.roles) || (await this.hasSelfRated(viewer.id, questionId));
    if (!unlocked) return { unlocked: false, maxMarks, items: [], nextPage: null };

    const rows = await this.prisma.sketchWork.findMany({
      where: { questionId, userId: { not: viewer.id }, versions: { some: { deletedAt: null } } },
      take: 500,
      include: {
        user: PERSON,
        question: {
          select: { criteria: true, rubric: { select: { title: true, factors: true } } },
        },
        versions: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: { peerFeedback: { select: { raterId: true, likedFactors: true } } },
        },
        _count: { select: { views: true, claps: true } },
      },
    });
    const assetIds = rows.flatMap((r) => r.versions.map((v) => v.assetId));
    const clean = new Set(
      (
        await this.prisma.cmsAsset.findMany({
          where: { id: { in: assetIds }, scanStatus: "CLEAN" },
          select: { id: true },
        })
      ).map((a) => a.id),
    );
    let cards: SketchCommunityCard[] = [];
    for (const r of rows) {
      const visible = r.versions.filter((v) => clean.has(v.assetId));
      const latest = visible[visible.length - 1];
      if (!latest) continue;
      const factors = factorsOf(r.question).factors.map((f) => f.title);
      const revisionNo = visible.filter((v) => v.kind === "REVISION").length;
      cards.push({
        workId: r.id,
        ownerName: nameOf(r.user),
        imageRef: `media:${latest.assetId}`,
        versionLabel: latest.kind === "TEST" ? "Test upload" : `Revision ${revisionNo}`,
        versionCount: r.versions.length,
        description: latest.description,
        views: r._count.views,
        claps: r._count.claps,
        communityTotal: latest.peerFeedback.length
          ? communityTotal(
              latest.peerFeedback.map((f) => f.likedFactors),
              factors,
              maxMarks,
            )
          : null,
        feedbackCount: latest.peerFeedback.length,
        ratedByMe: latest.peerFeedback.some((f) => f.raterId === viewer.id),
        updatedAt: latest.createdAt.toISOString(),
      });
    }
    if (opts.filter === "unrated") cards = cards.filter((c) => !c.ratedByMe);
    if (opts.filter === "rated") cards = cards.filter((c) => c.ratedByMe);
    cards.sort((a, b) =>
      opts.sort === "claps"
        ? b.claps - a.claps || b.updatedAt.localeCompare(a.updatedAt)
        : opts.sort === "top"
          ? (b.communityTotal ?? -1) - (a.communityTotal ?? -1) ||
            b.updatedAt.localeCompare(a.updatedAt)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
    const start = (opts.page - 1) * COMMUNITY_PAGE_SIZE;
    const items = cards.slice(start, start + COMMUNITY_PAGE_SIZE);
    return {
      unlocked: true,
      maxMarks,
      items,
      nextPage: start + COMMUNITY_PAGE_SIZE < cards.length ? opts.page + 1 : null,
    };
  }

  /** Sketch questions in the student's licensed courses, with community size and their own work. */
  async challenges(viewer: Viewer): Promise<SketchChallenge[]> {
    const now = new Date();
    const quizzes = await this.prisma.quiz.findMany({
      where: {
        deletedAt: null,
        status: "PUBLISHED",
        practiceCategoryId: { not: null },
        subject: {
          course: {
            deletedAt: null,
            enrollments: {
              some: {
                userId: viewer.id,
                status: "ACTIVE",
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              },
            },
          },
        },
        quizQuestions: { some: { question: { type: "UPLOAD", deletedAt: null } } },
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        subject: { select: { course: { select: { title: true } } } },
        quizQuestions: {
          where: { question: { type: "UPLOAD", deletedAt: null } },
          select: { question: { select: { id: true, text: true } } },
        },
      },
    });
    const seen = new Map<string, SketchChallenge>();
    for (const q of quizzes) {
      for (const qq of q.quizQuestions) {
        if (seen.has(qq.question.id)) continue;
        seen.set(qq.question.id, {
          questionId: qq.question.id,
          text: qq.question.text,
          courseTitle: q.subject?.course.title ?? "",
          test: { id: q.id, title: q.title },
          uploads: 0,
          myWorkId: null,
          myVersions: 0,
          unlocked: false,
        });
      }
    }
    const ids = [...seen.keys()];
    if (ids.length === 0) return [];
    await this.ensureWorks(viewer.id, ids);
    const works = await this.prisma.sketchWork.findMany({
      where: { questionId: { in: ids }, versions: { some: { deletedAt: null } } },
      select: {
        id: true,
        userId: true,
        questionId: true,
        _count: { select: { versions: { where: { deletedAt: null } } } },
      },
    });
    for (const w of works) {
      const c = seen.get(w.questionId)!;
      c.uploads++;
      if (w.userId === viewer.id) {
        c.myWorkId = w.id;
        c.myVersions = w._count.versions;
      }
    }
    for (const c of seen.values()) c.unlocked = await this.hasSelfRated(viewer.id, c.questionId);
    return [...seen.values()];
  }

  // ------------------------------------------------------------ uploading revisions

  private assertImage(mimeType: string, sizeBytes: number) {
    if (!IMAGE_TYPES.includes(mimeType)) {
      throw new BadRequestException("Upload a PNG, JPEG or WebP image");
    }
    if (sizeBytes > MAX_BYTES) throw new BadRequestException("Images must be 10 MB or smaller");
  }

  /** Revisions need a finished test containing the question, and room under the upload limit. */
  private async assertCanAddVersion(userId: string, questionId: string) {
    const finished = await this.prisma.quizAttempt.findFirst({
      where: {
        userId,
        status: { in: [...FINISHED] },
        quiz: { quizQuestions: { some: { questionId } } },
      },
      select: { id: true },
    });
    if (!finished) throw new ForbiddenException("Finish the test first, then add revisions here");
    await this.ensureWorks(userId, [questionId]);
    const count = await this.prisma.sketchVersion.count({
      where: { deletedAt: null, work: { userId, questionId } },
    });
    if (count >= MAX_SKETCH_VERSIONS) {
      throw new ConflictException(
        `You can upload up to ${MAX_SKETCH_VERSIONS} versions of a sketch`,
      );
    }
  }

  async presignVersion(
    userId: string,
    questionId: string,
    file: { fileName: string; mimeType: string; sizeBytes: number },
  ) {
    this.assertImage(file.mimeType, file.sizeBytes);
    await this.assertCanAddVersion(userId, questionId);
    const safe = file.fileName.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-60) || "sketch";
    return this.storage.createPresignedUploadUrl({
      key: `sketch-works/${userId}/${questionId}/${randomUUID()}-${safe}`,
      contentType: file.mimeType,
      contentLength: file.sizeBytes,
    });
  }

  async confirmVersion(
    userId: string,
    questionId: string,
    file: {
      storageKey: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      description?: string | null;
    },
  ): Promise<SketchWorkView> {
    this.assertImage(file.mimeType, file.sizeBytes);
    if (!file.storageKey.startsWith(`sketch-works/${userId}/${questionId}/`)) {
      throw new BadRequestException("storageKey doesn't belong to this question");
    }
    await this.assertCanAddVersion(userId, questionId);
    const asset = await this.prisma.cmsAsset.create({
      data: {
        storageKey: file.storageKey,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        altText: "Student sketch (revision)",
        uploadedById: userId,
      },
    });
    await this.scanQueue.enqueue(asset.id);
    const work = await this.prisma.sketchWork.upsert({
      where: { userId_questionId: { userId, questionId } },
      create: { userId, questionId },
      update: {},
      select: { id: true },
    });
    await this.prisma.sketchVersion.create({
      data: {
        workId: work.id,
        kind: "REVISION",
        assetId: asset.id,
        description: file.description?.trim() || null,
      },
    });
    return this.loadWork(work.id, { id: userId, roles: [] });
  }

  private async ownVersion(userId: string, versionId: string) {
    const v = await this.prisma.sketchVersion.findFirst({
      where: { id: versionId, deletedAt: null },
      select: { id: true, kind: true, workId: true, work: { select: { userId: true } } },
    });
    if (!v || v.work.userId !== userId) throw new NotFoundException("Sketch version not found");
    return v;
  }

  async updateDescription(userId: string, versionId: string, description: string | null) {
    const v = await this.ownVersion(userId, versionId);
    await this.prisma.sketchVersion.update({
      where: { id: versionId },
      data: { description: description?.trim() || null },
    });
    return this.loadWork(v.workId, { id: userId, roles: [] });
  }

  async deleteVersion(userId: string, versionId: string) {
    const v = await this.ownVersion(userId, versionId);
    if (v.kind === "TEST") throw new BadRequestException("The test upload can't be deleted");
    await this.prisma.sketchVersion.update({
      where: { id: versionId },
      data: { deletedAt: new Date() },
    });
    return this.loadWork(v.workId, { id: userId, roles: [] });
  }

  // ------------------------------------------------------------ claps, comments, reports

  async toggleClap(viewer: Viewer, workId: string): Promise<{ clapped: boolean; claps: number }> {
    const work = await this.workFor(viewer, workId);
    if (work.userId === viewer.id) {
      throw new BadRequestException("You can't clap for your own sketch");
    }
    const existing = await this.prisma.sketchClap.findUnique({
      where: { workId_userId: { workId, userId: viewer.id } },
    });
    if (existing) {
      await this.prisma.sketchClap.delete({
        where: { workId_userId: { workId, userId: viewer.id } },
      });
    } else {
      await this.prisma.sketchClap.create({ data: { workId, userId: viewer.id } });
    }
    const claps = await this.prisma.sketchClap.count({ where: { workId } });
    return { clapped: !existing, claps };
  }

  async addComment(viewer: Viewer, workId: string, body: string): Promise<SketchWorkView> {
    await this.workFor(viewer, workId);
    const text = body.trim();
    if (!text) throw new BadRequestException("Write a comment");
    await this.prisma.sketchWorkComment.create({
      data: { workId, authorId: viewer.id, body: text },
    });
    return this.loadWork(workId, viewer);
  }

  async deleteComment(viewer: Viewer, commentId: string): Promise<void> {
    const c = await this.prisma.sketchWorkComment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: { authorId: true },
    });
    if (!c) throw new NotFoundException("Comment not found");
    if (c.authorId !== viewer.id && !isSketchStaff(viewer.roles)) {
      throw new ForbiddenException("You can only delete your own comments");
    }
    await this.prisma.sketchWorkComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  async report(viewer: Viewer, workId: string, reason: string): Promise<void> {
    const work = await this.workFor(viewer, workId);
    if (work.userId === viewer.id) {
      throw new BadRequestException("You can't report your own sketch");
    }
    const text = reason.trim();
    if (text.length < 3) throw new BadRequestException("Tell us what's wrong");
    await this.prisma.sketchReport.upsert({
      where: { workId_reporterId: { workId, reporterId: viewer.id } },
      create: { workId, reporterId: viewer.id, reason: text },
      update: { reason: text, status: "OPEN" },
    });
  }

  // ------------------------------------------------------------ pins per version

  private async versionFor(viewer: Viewer, versionId: string) {
    const v = await this.prisma.sketchVersion.findFirst({
      where: { id: versionId, deletedAt: null },
      select: {
        id: true,
        kind: true,
        answerId: true,
        work: { select: { userId: true, questionId: true } },
      },
    });
    if (!v) throw new NotFoundException("Sketch version not found");
    await this.assertCanView(viewer, v.work);
    return v;
  }

  async pins(viewer: Viewer, versionId: string): Promise<SketchCommentView[]> {
    const v = await this.versionFor(viewer, versionId);
    const rows = await this.prisma.sketchComment.findMany({
      where: {
        deletedAt: null,
        OR: [{ versionId }, ...(v.answerId ? [{ answerId: v.answerId, versionId: null }] : [])],
      },
      orderBy: { createdAt: "asc" },
      include: { author: PERSON_WITH_ROLES },
    });
    return rows.map((c) => {
      const roles = c.author.roles.map((r) => r.role.name);
      return {
        id: c.id,
        x: c.x,
        y: c.y,
        body: c.body,
        authorName: nameOf(c.author),
        authorKind:
          c.author.id === v.work.userId ? "OWNER" : isSketchStaff(roles) ? "EXPERT" : "PEER",
        mine: c.author.id === viewer.id,
        createdAt: c.createdAt.toISOString(),
      };
    });
  }

  async addPin(viewer: Viewer, versionId: string, input: { x: number; y: number; body: string }) {
    const v = await this.versionFor(viewer, versionId);
    const body = input.body.trim();
    if (!body) throw new BadRequestException("Write a comment");
    await this.prisma.sketchComment.create({
      data: { versionId, answerId: v.answerId, authorId: viewer.id, x: input.x, y: input.y, body },
    });
    return this.pins(viewer, versionId);
  }

  // ------------------------------------------------------------ admin: rubrics & reports

  async rubrics(): Promise<SketchRubricView[]> {
    const rows = await this.prisma.sketchRubric.findMany({
      orderBy: { title: "asc" },
      include: { _count: { select: { questions: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      factors: toFactors(r.factors),
      questionCount: r._count.questions,
    }));
  }

  private cleanFactors(factors: FactorInput[]): RubricFactor[] {
    const clean = factors
      .map((f) => ({ title: f.title.trim(), description: f.description?.trim() || null }))
      .filter((f) => f.title);
    if (clean.length === 0) throw new BadRequestException("Add at least one factor");
    if (new Set(clean.map((f) => f.title.toLowerCase())).size !== clean.length) {
      throw new BadRequestException("Factor names must be different");
    }
    return clean;
  }

  async createRubric(input: { title: string; factors: FactorInput[] }) {
    const r = await this.prisma.sketchRubric.create({
      data: {
        title: input.title.trim(),
        factors: this.cleanFactors(input.factors) as unknown as Prisma.InputJsonValue,
      },
    });
    return r.id;
  }

  async updateRubric(id: string, input: { title?: string; factors?: FactorInput[] }) {
    const exists = await this.prisma.sketchRubric.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Rating set not found");
    const factors = input.factors !== undefined ? this.cleanFactors(input.factors) : undefined;
    await this.prisma.sketchRubric.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(factors ? { factors: factors as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    // Keep linked questions' criteria (used for self and expert scores) in step with the factors.
    if (factors) {
      await this.prisma.question.updateMany({
        where: { rubricId: id },
        data: { criteria: factors.map((f) => f.title) as unknown as Prisma.InputJsonValue },
      });
    }
  }

  async deleteRubric(id: string) {
    const { count } = await this.prisma.sketchRubric.deleteMany({ where: { id } });
    if (count === 0) throw new NotFoundException("Rating set not found");
  }

  async reports(status: "OPEN" | "RESOLVED"): Promise<SketchReportView[]> {
    const rows = await this.prisma.sketchReport.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        reporter: PERSON,
        work: {
          select: {
            id: true,
            user: PERSON,
            question: { select: { text: true } },
            versions: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { assetId: true },
            },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      workId: r.work.id,
      reason: r.reason,
      status: r.status === "RESOLVED" ? "RESOLVED" : "OPEN",
      reporterName: nameOf(r.reporter),
      ownerName: nameOf(r.work.user),
      questionText: r.work.question.text,
      imageRef: r.work.versions[0] ? `media:${r.work.versions[0].assetId}` : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async setReportStatus(id: string, status: "OPEN" | "RESOLVED") {
    const { count } = await this.prisma.sketchReport.updateMany({
      where: { id },
      data: { status },
    });
    if (count === 0) throw new NotFoundException("Report not found");
  }
}
