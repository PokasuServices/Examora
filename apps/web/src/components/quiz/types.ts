/** questionId -> selected option ids. Mirrors AttemptQuestion.selectedOptionIds locally. */
export type AnswersMap = Record<string, string[]>;

export type PaletteTone = "current" | "answered" | "unanswered" | "correct" | "wrong";
