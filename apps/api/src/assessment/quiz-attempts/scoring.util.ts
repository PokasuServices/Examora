import type { SnapshotQuestion } from "./attempt-snapshot.types";

export interface ScoringQuestionInput {
  id: string;
  /** Defaults to an option-based question when omitted. */
  type?: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "NUMERIC" | "UPLOAD";
  correctOptionIds: string[];
  /** MULTIPLE_CHOICE: award a share of the marks for a correct-but-incomplete selection. */
  partialMarking?: boolean;
  /** NUMERIC: inclusive accepted range. */
  numericMin?: number | null;
  numericMax?: number | null;
}

export interface ScoringAnswerInput {
  questionId: string;
  selectedOptionIds: string[];
  numericAnswer?: number | null;
  /** UPLOAD questions: a sketch was uploaded. */
  uploaded?: boolean;
}

export interface ScoredAnswer {
  questionId: string;
  selectedOptionIds: string[];
  numericAnswer: number | null;
  /**
   * null = unanswered (never counted as wrong, never negative-marked).
   * true = earned marks (full, or partial when marksAwarded < the question's marks).
   */
  isCorrect: boolean | null;
  marksAwarded: number;
}

export interface ScoreResult {
  answers: ScoredAnswer[];
  obtainedMarks: number;
  /** Answers that earned marks, including partially correct ones. */
  correctCount: number;
  /** UPLOAD answers waiting for a reviewer (not counted as correct, wrong or unanswered). */
  pendingCount: number;
  wrongCount: number;
  unansweredCount: number;
  percentage: number;
  passed: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Marks lost for a wrong answer: the question's own value if set, else the quiz-wide rule. */
function penaltyFor(
  s: SnapshotQuestion,
  negativeMarkingEnabled: boolean,
  negativeMarksPerWrong: number,
): number {
  if (s.negativeMarks !== undefined && s.negativeMarks !== null) return s.negativeMarks;
  return negativeMarkingEnabled ? s.marks * negativeMarksPerWrong : 0;
}

/**
 * Pure scoring function (ADR-0014, extended by the student module redesign).
 *
 * - SINGLE_CHOICE / TRUE_FALSE / MULTIPLE_CHOICE: correct when the selected
 *   set equals the correct set.
 * - MULTIPLE_CHOICE with partialMarking: selecting only correct options but
 *   not all of them earns marks × (picked / total correct); any wrong pick
 *   makes the whole answer wrong.
 * - NUMERIC: correct when the typed number is within [numericMin, numericMax].
 *
 * Unanswered questions score 0 and are never negative-marked. A wrong answer
 * loses the question's own negativeMarks when the quiz set one for it, else
 * marks × negativeMarksPerWrong when the quiz enables negative marking. The
 * total is not clamped to zero, so the cost of wrong answers is never hidden.
 */
export function computeScore(params: {
  snapshot: SnapshotQuestion[];
  answers: ScoringAnswerInput[];
  questions: ScoringQuestionInput[];
  totalMarks: number;
  negativeMarkingEnabled: boolean;
  negativeMarksPerWrong: number;
  passingScorePercent: number;
}): ScoreResult {
  const answerByQuestion = new Map(params.answers.map((a) => [a.questionId, a]));
  const questionById = new Map(params.questions.map((q) => [q.id, q]));

  let obtainedMarks = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let pendingCount = 0;
  const answers: ScoredAnswer[] = [];

  for (const s of params.snapshot) {
    const answer = answerByQuestion.get(s.questionId);
    const selected = answer?.selectedOptionIds ?? [];
    const numeric = answer?.numericAnswer ?? null;
    const question = questionById.get(s.questionId);
    if (question?.type === "UPLOAD") {
      // Sketches are marked by a reviewer later (SketchReview); 0 marks until then.
      if (answer?.uploaded) pendingCount += 1;
      else unansweredCount += 1;
      answers.push({
        questionId: s.questionId,
        selectedOptionIds: [],
        numericAnswer: null,
        isCorrect: null,
        marksAwarded: 0,
      });
      continue;
    }
    const isNumeric = question?.type === "NUMERIC";
    const answered = isNumeric ? numeric !== null && Number.isFinite(numeric) : selected.length > 0;

    if (!question || !answered) {
      unansweredCount += 1;
      answers.push({
        questionId: s.questionId,
        selectedOptionIds: selected,
        numericAnswer: numeric,
        isCorrect: null,
        marksAwarded: 0,
      });
      continue;
    }

    let marksAwarded: number;
    if (isNumeric) {
      const min = question.numericMin ?? null;
      const max = question.numericMax ?? null;
      const ok = min !== null && max !== null && numeric! >= min && numeric! <= max;
      marksAwarded = ok ? s.marks : 0;
    } else {
      const correctSet = new Set(question.correctOptionIds);
      const selectedSet = new Set(selected);
      const anyWrong = [...selectedSet].some((id) => !correctSet.has(id));
      if (anyWrong) {
        marksAwarded = 0;
      } else if (selectedSet.size === correctSet.size) {
        marksAwarded = s.marks;
      } else if (question.type === "MULTIPLE_CHOICE" && question.partialMarking) {
        marksAwarded = round2((s.marks * selectedSet.size) / correctSet.size);
      } else {
        marksAwarded = 0;
      }
    }

    let isCorrect: boolean;
    if (marksAwarded > 0) {
      isCorrect = true;
      correctCount += 1;
    } else {
      isCorrect = false;
      marksAwarded = -penaltyFor(s, params.negativeMarkingEnabled, params.negativeMarksPerWrong);
      wrongCount += 1;
    }
    obtainedMarks += marksAwarded;
    answers.push({
      questionId: s.questionId,
      selectedOptionIds: selected,
      numericAnswer: numeric,
      isCorrect,
      marksAwarded: round2(marksAwarded) || 0,
    });
  }

  obtainedMarks = round2(obtainedMarks);
  const percentage =
    params.totalMarks > 0 ? Math.round((obtainedMarks / params.totalMarks) * 10000) / 100 : 0;
  const passed = percentage >= params.passingScorePercent;

  return {
    answers,
    obtainedMarks,
    correctCount,
    wrongCount,
    unansweredCount,
    pendingCount,
    percentage,
    passed,
  };
}
