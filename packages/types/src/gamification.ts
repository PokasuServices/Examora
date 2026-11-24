/**
 * XP milestone ladder for the student Rewards popup. A student "reaches" a
 * milestone card once their total XP is at least its threshold.
 */
export const XP_MILESTONES = [5, 10, 50, 100, 500, 1000, 2500, 5000, 12000] as const;

export interface XpSummary {
  totalXp: number;
  /** Highest milestone reached so far, or null below the first one. */
  currentMilestone: number | null;
  /** Next milestone to reach, or null once the last one is reached. */
  nextMilestone: number | null;
  /** XP still needed for nextMilestone (0 when there is none). */
  xpToNext: number;
}
