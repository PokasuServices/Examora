import type { SnapshotQuestion } from "./attempt-snapshot.types";

export interface ScoringQuestionInput {
  id: string;
  correctOptionIds: string[];
}

export interface ScoringAnswerInput {
  questionId: string;
  selectedOptionIds: string[];
}

export interface ScoredAnswer {
  questionId: string;
  selectedOptionIds: string[];
  /** null means unanswered — never counted as wrong, never negative-marked. */
  isCorrect: boolean | null;
  marksAwarded: number;
}

export interface ScoreResult {
  answers: ScoredAnswer[];
  obtainedMarks: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  percentage: number;
  passed: boolean;
}

/**
 * Pure scoring function (ADR-0014). All-or-nothing per question — a
 * MULTIPLE_CHOICE answer must select exactly the correct-option set to
 * count as correct; a SINGLE_CHOICE/TRUE_FALSE question already has exactly
 * one correct option so the same equality check applies uniformly. Unanswered
 * questions always score 0 and are never negative-marked. Total is not
 * clamped to zero — a heavily negative-marked attempt can show a negative
 * total so the cost of wrong answers is never hidden.
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
  const answers: ScoredAnswer[] = [];

  for (const s of params.snapshot) {
    const answer = answerByQuestion.get(s.questionId);
    const selected = answer?.selectedOptionIds ?? [];
    const question = questionById.get(s.questionId);

    if (!question || selected.length === 0) {
      unansweredCount += 1;
      answers.push({
        questionId: s.questionId,
        selectedOptionIds: selected,
        isCorrect: null,
        marksAwarded: 0,
      });
      continue;
    }

    const correctSet = new Set(question.correctOptionIds);
    const selectedSet = new Set(selected);
    const isCorrect =
      selectedSet.size === correctSet.size && [...selectedSet].every((id) => correctSet.has(id));

    let marksAwarded: number;
    if (isCorrect) {
      marksAwarded = s.marks;
      correctCount += 1;
    } else {
      marksAwarded = params.negativeMarkingEnabled ? -(s.marks * params.negativeMarksPerWrong) : 0;
      wrongCount += 1;
    }
    obtainedMarks += marksAwarded;
    answers.push({
      questionId: s.questionId,
      selectedOptionIds: selected,
      isCorrect,
      marksAwarded,
    });
  }

  obtainedMarks = Math.round(obtainedMarks * 100) / 100;
  const percentage =
    params.totalMarks > 0 ? Math.round((obtainedMarks / params.totalMarks) * 10000) / 100 : 0;
  const passed = percentage >= params.passingScorePercent;

  return { answers, obtainedMarks, correctCount, wrongCount, unansweredCount, percentage, passed };
}
