import { BadRequestException } from "@nestjs/common";
import { cleanScores } from "../../sketches/sketches.service";
import { todayInIndia } from "../../daily-quiz/daily-quiz.service";
import { analyseAnswers, shortName } from "./attempt-analysis.service";

type Row = Parameters<typeof analyseAnswers>[0][number];

const row = (over: Partial<Row>): Row => ({
  marks: 1,
  awarded: 1,
  correct: true,
  pending: false,
  method: "KNOWLEDGE",
  seconds: 20,
  visited: true,
  subjectId: "s1",
  subjectTitle: "Mental Ability",
  topicId: "t1",
  topicTitle: "Puzzles",
  ...over,
});

describe("analyseAnswers", () => {
  it("counts methods, guesses and unattempted questions", () => {
    const r = analyseAnswers([
      row({}),
      row({ method: "GUESS", awarded: 1 }),
      row({ method: "ELIMINATION", correct: false, awarded: -0.25 }),
      row({ correct: null, awarded: 0, seconds: 12 }),
    ]);
    expect(r.methods.KNOWLEDGE).toEqual({ attempted: 1, correct: 1, wrong: 0 });
    expect(r.methods.GUESS).toEqual({ attempted: 1, correct: 1, wrong: 0 });
    expect(r.methods.ELIMINATION).toEqual({ attempted: 1, correct: 0, wrong: 1 });
    expect(r.unattempted).toBe(1);
    expect(r.marksFromGuesses).toBe(1);
    expect(r.timeUsage.wasted).toEqual({ questions: 1, seconds: 12 });
  });

  it("classifies topics: wrong-from-knowledge is weak, full marks is strong, the rest is opportunity", () => {
    const r = analyseAnswers([
      row({ topicId: "weak", topicTitle: "Weak", correct: false, awarded: 0 }),
      row({ topicId: "strong", topicTitle: "Strong" }),
      row({ topicId: "opp", topicTitle: "Opp", method: "GUESS" }),
      row({ topicId: "part", topicTitle: "Part", marks: 10, awarded: 7 }),
    ]);
    expect(r.weakTopics.map((t) => t.topicTitle)).toEqual(["Weak"]);
    expect(r.strongTopics.map((t) => t.topicTitle)).toEqual(["Strong"]);
    expect(r.opportunityTopics.map((t) => t.topicTitle).sort()).toEqual(["Opp", "Part"]);
    expect(r.opportunityTopics.find((t) => t.topicTitle === "Part")?.gain).toBe(3);
  });

  it("splits each topic by answer method and keeps its question numbers", () => {
    const r = analyseAnswers([
      row({ topicId: "t1" }),
      row({ topicId: "other", topicTitle: "Other" }),
      row({ topicId: "t1", correct: false, awarded: 0 }),
      row({ topicId: "t1", method: "GUESS" }),
      row({ topicId: "t1", method: "ELIMINATION", correct: null, awarded: 0 }),
    ]);
    const t1 = r.weakTopics.find((t) => t.topicId === "t1");
    expect(t1?.questionNumbers).toEqual([1, 3, 4, 5]);
    expect(t1?.byMethod).toEqual({
      KNOWLEDGE: { answered: 2, correct: 1 },
      ELIMINATION: { answered: 0, correct: 0 },
      GUESS: { answered: 1, correct: 1 },
    });
  });

  it("splits time into wisely used (correct ≤ 90 s), over spent, and lost (wrong)", () => {
    const r = analyseAnswers([
      row({ seconds: 30 }),
      row({ seconds: 120 }),
      row({ correct: false, awarded: 0, seconds: 50 }),
    ]);
    expect(r.timeUsage.wiselyUsed).toEqual({ questions: 1, seconds: 30 });
    expect(r.timeUsage.overSpent).toEqual({ questions: 1, seconds: 120 });
    expect(r.timeUsage.lost).toEqual({ questions: 1, seconds: 50 });
    expect(r.timeBuckets.map((b) => b.questions)).toEqual([0, 2, 1]);
  });

  it("leaves sketches awaiting review out of every count", () => {
    const r = analyseAnswers([row({ pending: true, correct: null, awarded: 0 })]);
    expect(r.unattempted).toBe(0);
    expect(r.methods.KNOWLEDGE.attempted).toBe(0);
  });
});

describe("helpers", () => {
  it("shortName shows a first name and last initial only", () => {
    expect(shortName("Demo", "Student", "x@y.z")).toBe("Demo S.");
    expect(shortName(null, null, "riya@example.test")).toBe("riya");
  });

  it("cleanScores requires a 1–5 score for every criterion and drops extras", () => {
    expect(cleanScores(["A", "B"], { A: 3, B: 5, C: 1 })).toEqual({ A: 3, B: 5 });
    expect(() => cleanScores(["A"], { A: 6 })).toThrow(BadRequestException);
    expect(() => cleanScores(["A"], {})).toThrow(BadRequestException);
  });

  it("todayInIndia rolls over at Indian midnight, not UTC midnight", () => {
    // 20:00 UTC on 1 Jan is 01:30 IST on 2 Jan.
    expect(todayInIndia(new Date("2027-01-01T20:00:00Z")).toISOString()).toBe(
      "2027-01-02T00:00:00.000Z",
    );
    expect(todayInIndia(new Date("2027-01-01T10:00:00Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });
});
