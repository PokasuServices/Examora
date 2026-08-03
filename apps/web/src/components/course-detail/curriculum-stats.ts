import type { Curriculum } from "@examora/types";

export { formatDuration } from "@/lib/format";

/** No server-side duration rollup exists — safe to sum client-side here since we already have the one course's full tree in memory for rendering. */
export function totalDurationMinutes(curriculum: Curriculum): number {
  return curriculum.subjects
    .flatMap((s) => s.topics)
    .flatMap((t) => t.modules)
    .flatMap((m) => m.lessons)
    .reduce((sum, l) => sum + (l.durationMinutes ?? 0), 0);
}
