import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateQuestionDto } from "./create-question.dto";

async function validateInput(input: Record<string, unknown>) {
  return validate(plainToInstance(CreateQuestionDto, input));
}

const validOptions = [
  { text: "A", isCorrect: true },
  { text: "B", isCorrect: false },
];

describe("CreateQuestionDto", () => {
  it("accepts a minimal valid payload", async () => {
    const errors = await validateInput({
      type: "SINGLE_CHOICE",
      text: "2 + 2 = ?",
      options: validOptions,
    });
    expect(errors).toHaveLength(0);
  });

  it("rejects a missing type", async () => {
    const errors = await validateInput({ text: "X", options: validOptions });
    expect(errors.some((e) => e.property === "type")).toBe(true);
  });

  it("rejects an invalid question type", async () => {
    const errors = await validateInput({ type: "ESSAY", text: "X", options: validOptions });
    expect(errors.some((e) => e.property === "type")).toBe(true);
  });

  it("rejects fewer than 2 options", async () => {
    const errors = await validateInput({
      type: "SINGLE_CHOICE",
      text: "X",
      options: [{ text: "Only one", isCorrect: true }],
    });
    expect(errors.some((e) => e.property === "options")).toBe(true);
  });

  it("rejects an option missing isCorrect", async () => {
    const errors = await validateInput({
      type: "SINGLE_CHOICE",
      text: "X",
      options: [{ text: "A" }, { text: "B", isCorrect: false }],
    });
    expect(errors.some((e) => e.property === "options")).toBe(true);
  });

  it("accepts an optional difficulty and tags", async () => {
    const errors = await validateInput({
      type: "MULTIPLE_CHOICE",
      difficulty: "HARD",
      tags: ["algebra", "grade-10"],
      text: "X",
      options: validOptions,
    });
    expect(errors).toHaveLength(0);
  });
});
