/**
 * Fisher-Yates shuffle, returning a new array (input is never mutated).
 * Used to freeze a randomized question/option order once at quiz-attempt
 * start (ADR-0014) — callers persist the result rather than re-shuffling.
 */
export function shuffle<T>(input: readonly T[]): T[] {
  const result = [...input];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
