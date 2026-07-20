import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { RecentQueryDto } from "./recent-query.dto";

async function validateInput(input: Record<string, unknown>) {
  const dto = plainToInstance(RecentQueryDto, input, { enableImplicitConversion: true });
  return { dto, errors: await validate(dto) };
}

describe("RecentQueryDto", () => {
  it("defaults limit to 10 when omitted", async () => {
    const { dto, errors } = await validateInput({});
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(10);
  });

  it("coerces a numeric-string limit", async () => {
    const { dto, errors } = await validateInput({ limit: "25" });
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(25);
  });

  it("rejects a limit above the maximum", async () => {
    const { errors } = await validateInput({ limit: "51" });
    expect(errors.some((e) => e.property === "limit")).toBe(true);
  });

  it("rejects a limit below the minimum", async () => {
    const { errors } = await validateInput({ limit: "0" });
    expect(errors.some((e) => e.property === "limit")).toBe(true);
  });
});
