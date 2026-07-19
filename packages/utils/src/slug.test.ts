import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Visual Spatial Ability")).toBe("visual-spatial-ability");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugify("NID UG | UCEED —  Practice!")).toBe("nid-ug-uceed-practice");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  --Design--  ")).toBe("design");
  });

  it("removes diacritics", () => {
    expect(slugify("Résumé Café")).toBe("resume-cafe");
  });

  it("caps length at 80 characters", () => {
    expect(slugify("a".repeat(120))).toHaveLength(80);
  });
});
