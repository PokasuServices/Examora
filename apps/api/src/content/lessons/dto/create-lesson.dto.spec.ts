import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateLessonDto } from "./create-lesson.dto";

async function validateInput(input: Record<string, unknown>) {
  return validate(plainToInstance(CreateLessonDto, input));
}

const moduleId = "11111111-1111-4111-8111-111111111111";

describe("CreateLessonDto", () => {
  it("accepts a valid TEXT lesson", async () => {
    expect(
      await validateInput({ moduleId, title: "Intro", contentType: "TEXT", body: "hi" }),
    ).toHaveLength(0);
  });

  it("defaults are allowed (contentType omitted)", async () => {
    expect(await validateInput({ moduleId, title: "Intro" })).toHaveLength(0);
  });

  it("rejects an unknown contentType", async () => {
    const errors = await validateInput({ moduleId, title: "Intro", contentType: "HOLOGRAM" });
    expect(errors.some((e) => e.property === "contentType")).toBe(true);
  });

  it("rejects a malformed contentUrl", async () => {
    const errors = await validateInput({ moduleId, title: "Intro", contentUrl: "not a url" });
    expect(errors.some((e) => e.property === "contentUrl")).toBe(true);
  });

  it("rejects a negative durationMinutes", async () => {
    const errors = await validateInput({ moduleId, title: "Intro", durationMinutes: -5 });
    expect(errors.some((e) => e.property === "durationMinutes")).toBe(true);
  });

  it("rejects a missing moduleId", async () => {
    const errors = await validateInput({ title: "Intro" });
    expect(errors.some((e) => e.property === "moduleId")).toBe(true);
  });
});
