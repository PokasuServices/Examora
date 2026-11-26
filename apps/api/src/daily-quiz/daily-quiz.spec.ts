import { monthStart, rankPeriod, standingOf, streaks, weekStart } from "./daily-quiz.service";

const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

describe("daily quiz maths", () => {
  it("counts the current streak up to today, or up to yesterday if today isn't played yet", () => {
    const played = new Set(["2026-11-20", "2026-11-21", "2026-11-23", "2026-11-24", "2026-11-25"]);
    expect(streaks(played, day("2026-11-25"))).toEqual({ current: 3, best: 3 });
    // Today (26th) not played yet: the streak from yesterday is still alive.
    expect(streaks(played, day("2026-11-26")).current).toBe(3);
    // Missed yesterday too: the streak is broken.
    expect(streaks(played, day("2026-11-27")).current).toBe(0);
  });

  it("finds the longest run anywhere in the history", () => {
    const played = new Set(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-11-01"]);
    expect(streaks(played, day("2026-11-01"))).toEqual({ current: 1, best: 4 });
  });

  it("weeks start on Monday and months on the 1st", () => {
    expect(weekStart(day("2026-11-26")).toISOString().slice(0, 10)).toBe("2026-11-23");
    expect(weekStart(day("2026-11-23")).toISOString().slice(0, 10)).toBe("2026-11-23");
    expect(weekStart(day("2026-11-29")).toISOString().slice(0, 10)).toBe("2026-11-23");
    expect(monthStart(day("2026-11-26")).toISOString().slice(0, 10)).toBe("2026-11-01");
  });

  it("ranks a period by total correct, then time, and says what it takes to climb", () => {
    const rows = [
      { userId: "a", date: "2026-11-23", correct: 9, totalMs: 40_000 },
      { userId: "a", date: "2026-11-24", correct: 8, totalMs: 40_000 },
      { userId: "b", date: "2026-11-23", correct: 9, totalMs: 30_000 },
      { userId: "b", date: "2026-11-24", correct: 8, totalMs: 30_000 },
      { userId: "me", date: "2026-11-24", correct: 7, totalMs: 20_000 },
      { userId: "old", date: "2026-11-10", correct: 10, totalMs: 1 },
    ];
    const ranked = rankPeriod(rows, "2026-11-23", "2026-11-29");
    expect(ranked.map((r) => r.userId)).toEqual(["b", "a", "me"]);
    const me = standingOf(ranked, "me");
    expect(me).toMatchObject({ rank: 3, candidates: 3, percentile: 0, correct: 7, days: 1 });
    expect(me.toNext).toBe(11); // a has 17, me 7: 11 more correct to pass
    expect(standingOf(ranked, "b")).toMatchObject({ rank: 1, percentile: 100, toNext: null });
    expect(standingOf(ranked, "nobody")).toMatchObject({ rank: null, candidates: 3 });
  });
});
