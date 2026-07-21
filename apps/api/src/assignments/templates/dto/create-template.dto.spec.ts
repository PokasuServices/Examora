import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateTemplateDto } from "./create-template.dto";

async function validateInput(input: Record<string, unknown>) {
  return validate(plainToInstance(CreateTemplateDto, input));
}

const fileRules = { allowedMimeTypes: ["image/png"], maxFileSizeMb: 10, maxFiles: 3 };
const rubric = [{ title: "Creativity", maxMarks: 10 }];

describe("CreateTemplateDto", () => {
  it("accepts a valid payload", async () => {
    const errors = await validateInput({
      title: "Poster Template",
      brief: "b",
      fileRules,
      marksTotal: 10,
      rubric,
    });
    expect(errors).toHaveLength(0);
  });

  it("rejects an empty rubric", async () => {
    const errors = await validateInput({
      title: "X",
      brief: "b",
      fileRules,
      marksTotal: 10,
      rubric: [],
    });
    expect(errors.some((e) => e.property === "rubric")).toBe(true);
  });

  it("rejects a rubric item missing maxMarks", async () => {
    const errors = await validateInput({
      title: "X",
      brief: "b",
      fileRules,
      marksTotal: 10,
      rubric: [{ title: "Creativity" }],
    });
    expect(errors.some((e) => e.property === "rubric")).toBe(true);
  });
});
