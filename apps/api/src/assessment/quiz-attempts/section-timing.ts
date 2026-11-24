import type { Prisma } from "@examora/database";

/** One section of a timed-by-section attempt, frozen when the attempt starts. */
export interface SectionPlanItem {
  id: string;
  title: string;
  minutes: number;
}

/** The section plan stored on an attempt, or null for a test timed as a whole. */
export function readPlan(json: Prisma.JsonValue | null): SectionPlanItem[] | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  const plan = json.flatMap((s) =>
    s &&
    typeof s === "object" &&
    !Array.isArray(s) &&
    typeof s.id === "string" &&
    typeof s.title === "string" &&
    typeof s.minutes === "number" &&
    s.minutes > 0
      ? [{ id: s.id, title: s.title, minutes: s.minutes }]
      : [],
  );
  return plan.length === json.length ? plan : null;
}

/** A plan only when every section has its own time (otherwise the test is timed as a whole). */
export function planFor(
  sections: { id: string; title: string; timeLimitMinutes: number | null }[],
): SectionPlanItem[] | null {
  if (sections.length === 0) return null;
  if (sections.some((s) => !s.timeLimitMinutes || s.timeLimitMinutes <= 0)) return null;
  return sections.map((s) => ({ id: s.id, title: s.title, minutes: s.timeLimitMinutes! }));
}

const addMinutes = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

/** When the current section ends. */
export function sectionDeadline(
  plan: SectionPlanItem[],
  current: number,
  sectionStartedAt: Date,
): Date {
  return addMinutes(sectionStartedAt, plan[current]!.minutes);
}

/** When the whole attempt ends if every remaining section uses its full time. */
export function attemptDeadline(
  plan: SectionPlanItem[],
  current: number,
  sectionStartedAt: Date,
): Date {
  const remaining = plan.slice(current).reduce((t, s) => t + s.minutes, 0);
  return addMinutes(sectionStartedAt, remaining);
}

/**
 * Moves past every section whose time has run out. Each next section starts
 * the moment the previous one ended (even if the student was away), like a
 * real exam. The last section is never passed; its end is the attempt's end.
 */
export function advanceSections(
  plan: SectionPlanItem[],
  current: number,
  sectionStartedAt: Date,
  now: Date,
): { current: number; sectionStartedAt: Date } {
  let index = current;
  let started = sectionStartedAt;
  while (index < plan.length - 1) {
    const end = sectionDeadline(plan, index, started);
    if (now <= end) break;
    started = end;
    index++;
  }
  return { current: index, sectionStartedAt: started };
}
