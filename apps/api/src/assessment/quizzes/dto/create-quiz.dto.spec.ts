import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateQuizDto } from "./create-quiz.dto";

async function validateInput(input: Record<string, unknown>) {
  return validate(plainToInstance(CreateQuizDto, input));
}

describe("CreateQuizDto", () => {
  it("accepts a minimal valid payload (title only)", async () => {
    expect(await validateInput({ title: "NID UG Mock Test 1" })).toHaveLength(0);
  });

  it("rejects a missing title", async () => {
    const errors = await validateInput({});
    expect(errors.some((e) => e.property === "title")).toBe(true);
  });

  it("rejects a negative time limit", async () => {
    const errors = await validateInput({ title: "X", timeLimitMinutes: -5 });
    expect(errors.some((e) => e.property === "timeLimitMinutes")).toBe(true);
  });

  it("rejects a passing score above 100", async () => {
    const errors = await validateInput({ title: "X", passingScorePercent: 150 });
    expect(errors.some((e) => e.property === "passingScorePercent")).toBe(true);
  });

  it("rejects a negative-marks-per-wrong fraction above 1", async () => {
    const errors = await validateInput({ title: "X", negativeMarksPerWrong: 1.5 });
    expect(errors.some((e) => e.property === "negativeMarksPerWrong")).toBe(true);
  });

  it("accepts a fully-specified payload", async () => {
    const errors = await validateInput({
      title: "X",
      timeLimitMinutes: 60,
      passingScorePercent: 50,
      negativeMarkingEnabled: true,
      negativeMarksPerWrong: 0.25,
      shuffleQuestions: true,
      shuffleOptions: true,
    });
    expect(errors).toHaveLength(0);
  });
});
