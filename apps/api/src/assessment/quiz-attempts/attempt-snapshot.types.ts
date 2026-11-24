/**
 * Shape of QuizAttempt.questionSnapshot / optionOrder JSON columns (ADR-0014).
 * Frozen once at attempt start; never regenerated for the lifetime of the attempt.
 */
export interface SnapshotQuestion {
  questionId: string;
  sectionId: string | null;
  marks: number;
  /**
   * Marks lost for a wrong answer, frozen from QuizQuestion.negativeMarks at
   * start; absent (older attempts) or null = use the quiz-wide rule.
   */
  negativeMarks?: number | null;
}

export type QuestionSnapshot = SnapshotQuestion[];

/** { [questionId]: orderedOptionId[] } — the frozen (possibly shuffled) option order. */
export type OptionOrder = Record<string, string[]>;
