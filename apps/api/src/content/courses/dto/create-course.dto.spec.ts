import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCourseDto } from "./create-course.dto";

async function validateInput(input: Record<string, unknown>) {
  return validate(plainToInstance(CreateCourseDto, input));
}

describe("CreateCourseDto", () => {
  it("accepts a minimal valid payload (title only)", async () => {
    expect(await validateInput({ title: "NID Foundation" })).toHaveLength(0);
  });

  it("rejects a missing title", async () => {
    const errors = await validateInput({ examType: "NID" });
    expect(errors.some((e) => e.property === "title")).toBe(true);
  });

  it("rejects a non-uuid categoryId", async () => {
    const errors = await validateInput({ title: "X", categoryId: "not-a-uuid" });
    expect(errors.some((e) => e.property === "categoryId")).toBe(true);
  });

  it("rejects a slug that is not lowercase-hyphenated", async () => {
    const errors = await validateInput({ title: "X", slug: "Not A Slug" });
    expect(errors.some((e) => e.property === "slug")).toBe(true);
  });

  it("accepts a valid slug", async () => {
    expect(await validateInput({ title: "X", slug: "nid-foundation" })).toHaveLength(0);
  });
});
