import { summarizeXp } from "./xp.service";

describe("summarizeXp", () => {
  it("has no current milestone below the first one", () => {
    expect(summarizeXp(0)).toEqual({
      totalXp: 0,
      currentMilestone: null,
      nextMilestone: 5,
      xpToNext: 5,
    });
  });

  it("counts a milestone as reached at exactly its threshold", () => {
    expect(summarizeXp(100)).toMatchObject({
      currentMilestone: 100,
      nextMilestone: 500,
      xpToNext: 400,
    });
  });

  it("has no next milestone after the last one", () => {
    expect(summarizeXp(20000)).toMatchObject({
      currentMilestone: 12000,
      nextMilestone: null,
      xpToNext: 0,
    });
  });
});
