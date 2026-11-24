/** questionId -> selected option ids. Mirrors AttemptQuestion.selectedOptionIds locally. */
export type AnswersMap = Record<string, string[]>;

/** questionId -> the typed text of a NUMERIC answer ("" = unanswered). */
export type NumericMap = Record<string, string>;

/** Parses a typed numeric answer; null for empty or not-a-number. */
export function parseNumeric(raw: string | undefined): number | null {
  const t = (raw ?? "").trim().replace(",", ".");
  if (t === "" || t === "-" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export type PaletteTone = "current" | "answered" | "unanswered" | "correct" | "partial" | "wrong";
