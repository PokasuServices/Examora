/** questionId -> selected option ids. Mirrors AttemptQuestion.selectedOptionIds locally. */
export type AnswersMap = Record<string, string[]>;

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export type PaletteTone = "current" | "answered" | "unanswered" | "correct" | "wrong";
