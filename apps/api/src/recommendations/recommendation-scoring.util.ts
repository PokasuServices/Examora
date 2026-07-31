/**
 * Recommendation Scoring + Ranking Engine (Sprint 11, ADR-0021 §1). Pure,
 * deterministic functions over caller-supplied signals — no external calls,
 * no ML. Every recommendation service builds `{ item, score, reason }`
 * candidates and hands them to `rankAndExplain` for sorting/truncation.
 */

export interface ScoredCandidate<T> {
  item: T;
  score: number;
  reason: string;
}

/** Clamps a raw weighted-signal sum into a stable 0-100 display score. */
export function clampScore(rawScore: number): number {
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

/** Highest score first, truncated to `limit` — the engine's ranking step. */
export function rankAndExplain<T>(
  candidates: ScoredCandidate<T>[],
  limit: number,
): ScoredCandidate<T>[] {
  return candidates
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
