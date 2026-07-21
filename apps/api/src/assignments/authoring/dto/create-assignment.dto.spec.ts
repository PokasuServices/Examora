import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateAssignmentDto } from "./create-assignment.dto";

async function validateInput(input: Record<string, unknown>) {
  return validate(plainToInstance(CreateAssignmentDto, input));
}

const fileRules = { allowedMimeTypes: ["image/png"], maxFileSizeMb: 10, maxFiles: 3 };

describe("CreateAssignmentDto", () => {
  it("accepts a minimal valid payload", async () => {
    const errors = await validateInput({
      title: "Poster Design",
      brief: "Design a poster",
      fileRules,
      marksTotal: 20,
    });
    expect(errors).toHaveLength(0);
  });

  it("accepts a templateId-only payload (brief/fileRules/marksTotal optional)", async () => {
    const errors = await validateInput({
      title: "X",
      templateId: "22222222-2222-4222-8222-222222222222",
    });
    expect(errors).toHaveLength(0);
  });

  it("rejects a missing title", async () => {
    const errors = await validateInput({ brief: "b", fileRules, marksTotal: 10 });
    expect(errors.some((e) => e.property === "title")).toBe(true);
  });

  it("rejects an invalid fileRules shape", async () => {
    const errors = await validateInput({
      title: "X",
      brief: "b",
      marksTotal: 10,
      fileRules: { maxFiles: 1 },
    });
    expect(errors.some((e) => e.property === "fileRules")).toBe(true);
  });

  it("rejects a non-uuid subjectId", async () => {
    const errors = await validateInput({
      title: "X",
      brief: "b",
      fileRules,
      marksTotal: 10,
      subjectId: "not-a-uuid",
    });
    expect(errors.some((e) => e.property === "subjectId")).toBe(true);
  });
});
