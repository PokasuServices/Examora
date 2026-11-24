import type { PracticeTestItem } from "@examora/types";
import { buildSections, sortPapers } from "./practice.service";

const item = (id: string, paperYear: number | null): PracticeTestItem =>
  ({ id, paperYear }) as unknown as PracticeTestItem;

describe("sortPapers", () => {
  it("lists papers newest year first, keeping admin order for ties and undated tests last", () => {
    const sorted = sortPapers([
      item("a", 2023),
      item("b", null),
      item("c", 2025),
      item("d", 2023),
      item("e", 2024),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["c", "e", "a", "d", "b"]);
  });

  it("leaves a tab without dated tests in admin order", () => {
    const tests = [item("x", null), item("y", null)];
    expect(sortPapers(tests)).toBe(tests);
  });
});

describe("buildSections", () => {
  it("carries each section's own time limit", () => {
    const sections = buildSections(
      [
        { id: "a", title: "Part A", description: null, timeLimitMinutes: 120 },
        { id: "b", title: "Part B", description: null, timeLimitMinutes: null },
      ],
      [
        { sectionId: "a", type: "NUMERIC", partialMarking: false, marks: 4, negative: 0 },
        { sectionId: "b", type: "UPLOAD", partialMarking: false, marks: 50, negative: 0 },
      ],
    );
    expect(sections.map((s) => [s.title, s.timeLimitMinutes, s.totalMarks])).toEqual([
      ["Part A", 120, 4],
      ["Part B", null, 50],
    ]);
  });
});
