import { clampScore, rankAndExplain } from "./recommendation-scoring.util";

describe("recommendation-scoring.util", () => {
  describe("clampScore", () => {
    it("clamps below 0 up to 0", () => {
      expect(clampScore(-15)).toBe(0);
    });

    it("clamps above 100 down to 100", () => {
      expect(clampScore(150)).toBe(100);
    });

    it("rounds a fractional in-range score", () => {
      expect(clampScore(42.6)).toBe(43);
    });
  });

  describe("rankAndExplain", () => {
    it("sorts by score descending", () => {
      const candidates = [
        { item: "low", score: 10, reason: "" },
        { item: "high", score: 90, reason: "" },
        { item: "mid", score: 50, reason: "" },
      ];
      const ranked = rankAndExplain(candidates, 10);
      expect(ranked.map((c) => c.item)).toEqual(["high", "mid", "low"]);
    });

    it("truncates to the limit", () => {
      const candidates = Array.from({ length: 20 }, (_, i) => ({
        item: i,
        score: i,
        reason: "",
      }));
      expect(rankAndExplain(candidates, 5)).toHaveLength(5);
    });

    it("does not mutate the input array", () => {
      const candidates = [
        { item: "a", score: 1, reason: "" },
        { item: "b", score: 2, reason: "" },
      ];
      const original = [...candidates];
      rankAndExplain(candidates, 10);
      expect(candidates).toEqual(original);
    });
  });
});
