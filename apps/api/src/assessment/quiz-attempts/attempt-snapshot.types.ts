/**
 * Shape of QuizAttempt.questionSnapshot / optionOrder JSON columns (ADR-0014).
 * Frozen once at attempt start; never regenerated for the lifetime of the attempt.
 */
export interface SnapshotQuestion {
  questionId: string;
  sectionId: string | null;
  marks: number;
}

export type QuestionSnapshot = SnapshotQuestion[];

/** { [questionId]: orderedOptionId[] } — the frozen (possibly shuffled) option order. */
export type OptionOrder = Record<string, string[]>;
