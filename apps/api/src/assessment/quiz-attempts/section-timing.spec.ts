import {
  advanceSections,
  attemptDeadline,
  planFor,
  readPlan,
  sectionDeadline,
} from "./section-timing";

const plan = [
  { id: "a", title: "Part A", minutes: 120 },
  { id: "b", title: "Part B", minutes: 60 },
];
const t0 = new Date("2026-01-01T09:00:00Z");
const at = (min: number) => new Date(t0.getTime() + min * 60_000);

describe("section timing", () => {
  it("plans only when every section has its own time", () => {
    expect(planFor([{ id: "a", title: "A", timeLimitMinutes: 10 }])).toEqual([
      { id: "a", title: "A", minutes: 10 },
    ]);
    expect(
      planFor([
        { id: "a", title: "A", timeLimitMinutes: 10 },
        { id: "b", title: "B", timeLimitMinutes: null },
      ]),
    ).toBeNull();
    expect(planFor([])).toBeNull();
  });

  it("reads back only well-formed plans", () => {
    expect(readPlan(plan)).toEqual(plan);
    expect(readPlan([{ id: "a", title: "A", minutes: 0 }])).toBeNull();
    expect(readPlan(null)).toBeNull();
  });

  it("computes the section and attempt deadlines", () => {
    expect(sectionDeadline(plan, 0, t0)).toEqual(at(120));
    expect(attemptDeadline(plan, 0, t0)).toEqual(at(180));
    expect(attemptDeadline(plan, 1, at(30))).toEqual(at(90));
  });

  it("moves on when a section's time is up, starting the next at that moment", () => {
    expect(advanceSections(plan, 0, t0, at(119))).toEqual({ current: 0, sectionStartedAt: t0 });
    expect(advanceSections(plan, 0, t0, at(150))).toEqual({
      current: 1,
      sectionStartedAt: at(120),
    });
    // The last section is never passed: its end is the attempt's end.
    expect(advanceSections(plan, 1, at(120), at(500))).toEqual({
      current: 1,
      sectionStartedAt: at(120),
    });
  });
});
