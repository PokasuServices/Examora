import { computeScore } from "./scoring.util";

const snapshot = [
  { questionId: "q1", sectionId: null, marks: 4 },
  { questionId: "q2", sectionId: null, marks: 4 },
  { questionId: "q3", sectionId: null, marks: 2 },
];

const questions = [
  { id: "q1", correctOptionIds: ["q1-a"] }, // SINGLE_CHOICE/TRUE_FALSE style
  { id: "q2", correctOptionIds: ["q2-a", "q2-b"] }, // MULTIPLE_CHOICE, exact set required
  { id: "q3", correctOptionIds: ["q3-a"] },
];

function baseParams(
  answers: { questionId: string; selectedOptionIds: string[] }[],
  overrides: Partial<Parameters<typeof computeScore>[0]> = {},
) {
  return {
    snapshot,
    answers,
    questions,
    totalMarks: 10,
    negativeMarkingEnabled: false,
    negativeMarksPerWrong: 0,
    passingScorePercent: 40,
    ...overrides,
  };
}

describe("computeScore", () => {
  it("awards full marks for a correct single-choice answer", () => {
    const result = computeScore(baseParams([{ questionId: "q1", selectedOptionIds: ["q1-a"] }]));
    const q1 = result.answers.find((a) => a.questionId === "q1")!;
    expect(q1.isCorrect).toBe(true);
    expect(q1.marksAwarded).toBe(4);
    expect(result.correctCount).toBe(1);
  });

  it("requires the exact correct set for multiple-choice (partial selection is wrong)", () => {
    const result = computeScore(baseParams([{ questionId: "q2", selectedOptionIds: ["q2-a"] }]));
    const q2 = result.answers.find((a) => a.questionId === "q2")!;
    expect(q2.isCorrect).toBe(false);
    expect(q2.marksAwarded).toBe(0);
  });

  it("requires the exact correct set for multiple-choice (extra selection is wrong)", () => {
    const result = computeScore(
      baseParams([{ questionId: "q2", selectedOptionIds: ["q2-a", "q2-b", "q2-c"] }]),
    );
    const q2 = result.answers.find((a) => a.questionId === "q2")!;
    expect(q2.isCorrect).toBe(false);
  });

  it("scores an exact multiple-choice match as correct", () => {
    const result = computeScore(
      baseParams([{ questionId: "q2", selectedOptionIds: ["q2-b", "q2-a"] }]),
    );
    const q2 = result.answers.find((a) => a.questionId === "q2")!;
    expect(q2.isCorrect).toBe(true);
    expect(q2.marksAwarded).toBe(4);
  });

  it("never penalizes an unanswered question, with or without negative marking", () => {
    const result = computeScore(
      baseParams([], { negativeMarkingEnabled: true, negativeMarksPerWrong: 0.5 }),
    );
    expect(result.unansweredCount).toBe(3);
    expect(result.answers.every((a) => a.isCorrect === null && a.marksAwarded === 0)).toBe(true);
    expect(result.obtainedMarks).toBe(0);
  });

  it("applies negative marking only when enabled and only to attempted wrong answers", () => {
    const answers = [
      { questionId: "q1", selectedOptionIds: ["q1-b"] }, // wrong, attempted
      { questionId: "q2", selectedOptionIds: [] }, // unanswered
    ];
    const withoutNegative = computeScore(baseParams(answers, { negativeMarkingEnabled: false }));
    expect(withoutNegative.answers.find((a) => a.questionId === "q1")!.marksAwarded).toBe(0);

    const withNegative = computeScore(
      baseParams(answers, { negativeMarkingEnabled: true, negativeMarksPerWrong: 0.25 }),
    );
    const q1 = withNegative.answers.find((a) => a.questionId === "q1")!;
    expect(q1.isCorrect).toBe(false);
    expect(q1.marksAwarded).toBe(-1); // 4 marks * 0.25
    // the unanswered q2 is still untouched by negative marking
    expect(withNegative.answers.find((a) => a.questionId === "q2")!.marksAwarded).toBe(0);
  });

  it("does not clamp a heavily negative-marked total at zero", () => {
    const answers = [
      { questionId: "q1", selectedOptionIds: ["q1-b"] },
      { questionId: "q2", selectedOptionIds: ["q2-c"] },
      { questionId: "q3", selectedOptionIds: ["q3-b"] },
    ];
    const result = computeScore(
      baseParams(answers, { negativeMarkingEnabled: true, negativeMarksPerWrong: 1 }),
    );
    expect(result.obtainedMarks).toBe(-10);
    expect(result.percentage).toBeLessThan(0);
  });

  it("computes percentage and pass/fail against the passing threshold", () => {
    const passResult = computeScore(
      baseParams(
        [
          { questionId: "q1", selectedOptionIds: ["q1-a"] },
          { questionId: "q2", selectedOptionIds: ["q2-a", "q2-b"] },
        ],
        { passingScorePercent: 50 },
      ),
    );
    expect(passResult.percentage).toBe(80); // 8/10
    expect(passResult.passed).toBe(true);

    const failResult = computeScore(
      baseParams([{ questionId: "q3", selectedOptionIds: ["q3-a"] }], { passingScorePercent: 50 }),
    );
    expect(failResult.percentage).toBe(20); // 2/10
    expect(failResult.passed).toBe(false);
  });

  it("treats a question missing from the live question set as unanswered (defensive)", () => {
    const result = computeScore(
      baseParams([{ questionId: "q1", selectedOptionIds: ["q1-a"] }], {
        questions: questions.filter((q) => q.id !== "q1"),
      }),
    );
    const q1 = result.answers.find((a) => a.questionId === "q1")!;
    expect(q1.isCorrect).toBeNull();
    expect(q1.marksAwarded).toBe(0);
  });
});

describe("computeScore — question engine (numeric, partial, per-question penalty)", () => {
  const snap = (id: string, marks: number, negativeMarks?: number | null) => ({
    questionId: id,
    sectionId: null,
    marks,
    negativeMarks,
  });
  const base = {
    totalMarks: 10,
    negativeMarkingEnabled: false,
    negativeMarksPerWrong: 0,
    passingScorePercent: 40,
  };

  it("scores a NUMERIC answer by its inclusive range", () => {
    const questions = [
      {
        id: "n",
        type: "NUMERIC" as const,
        correctOptionIds: [],
        numericMin: 132.8,
        numericMax: 133.1,
      },
    ];
    const at = (value: number | null) =>
      computeScore({
        ...base,
        snapshot: [snap("n", 2)],
        questions,
        answers: [{ questionId: "n", selectedOptionIds: [], numericAnswer: value }],
      }).answers[0]!;
    expect(at(132.8)).toMatchObject({ isCorrect: true, marksAwarded: 2 });
    expect(at(133.1)).toMatchObject({ isCorrect: true, marksAwarded: 2 });
    expect(at(140)).toMatchObject({ isCorrect: false, marksAwarded: 0 });
    expect(at(null)).toMatchObject({ isCorrect: null, marksAwarded: 0 });
  });

  it("gives partial marks for a correct-but-incomplete multi-select, and none with a wrong pick", () => {
    const questions = [
      {
        id: "m",
        type: "MULTIPLE_CHOICE" as const,
        correctOptionIds: ["a", "b"],
        partialMarking: true,
      },
    ];
    const score = (selected: string[]) =>
      computeScore({
        ...base,
        negativeMarkingEnabled: true,
        negativeMarksPerWrong: 0.25,
        snapshot: [snap("m", 4)],
        questions,
        answers: [{ questionId: "m", selectedOptionIds: selected }],
      });
    expect(score(["a"]).answers[0]).toMatchObject({ isCorrect: true, marksAwarded: 2 });
    expect(score(["a", "b"]).answers[0]).toMatchObject({ isCorrect: true, marksAwarded: 4 });
    expect(score(["a", "c"]).answers[0]).toMatchObject({ isCorrect: false, marksAwarded: -1 });
    expect(score(["a"]).correctCount).toBe(1);
  });

  it("gives nothing for an incomplete multi-select without partial marking", () => {
    const result = computeScore({
      ...base,
      snapshot: [snap("m", 4)],
      questions: [{ id: "m", type: "MULTIPLE_CHOICE", correctOptionIds: ["a", "b"] }],
      answers: [{ questionId: "m", selectedOptionIds: ["a"] }],
    });
    expect(result.answers[0]).toMatchObject({ isCorrect: false, marksAwarded: 0 });
  });

  it("uses a question's own negative marks even when the quiz has negative marking off", () => {
    const result = computeScore({
      ...base,
      snapshot: [snap("s", 1, 0.71), snap("t", 1)],
      questions: [
        { id: "s", correctOptionIds: ["s-a"] },
        { id: "t", correctOptionIds: ["t-a"] },
      ],
      answers: [
        { questionId: "s", selectedOptionIds: ["s-b"] },
        { questionId: "t", selectedOptionIds: ["t-b"] },
      ],
    });
    expect(result.answers.map((a) => a.marksAwarded)).toEqual([-0.71, 0]);
    expect(result.obtainedMarks).toBe(-0.71);
  });
});
