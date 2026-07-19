import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { RegisterDto } from "./register.dto";

async function validateInput(input: Record<string, unknown>) {
  const dto = plainToInstance(RegisterDto, input);
  return validate(dto);
}

describe("RegisterDto", () => {
  const valid = {
    email: "student@example.com",
    password: "a-strong-password",
    consentVersion: "v1.0",
    acceptTerms: true,
  };

  it("passes with a valid payload", async () => {
    const errors = await validateInput(valid);
    expect(errors).toHaveLength(0);
  });

  it("rejects registration when terms are not accepted", async () => {
    const errors = await validateInput({ ...valid, acceptTerms: false });
    expect(errors.some((e) => e.property === "acceptTerms")).toBe(true);
  });

  it("rejects registration when acceptTerms is missing", async () => {
    const { acceptTerms: _omit, ...withoutAcceptTerms } = valid;
    const errors = await validateInput(withoutAcceptTerms);
    expect(errors.some((e) => e.property === "acceptTerms")).toBe(true);
  });

  it("rejects a short password", async () => {
    const errors = await validateInput({ ...valid, password: "short" });
    expect(errors.some((e) => e.property === "password")).toBe(true);
  });

  it("rejects an invalid email", async () => {
    const errors = await validateInput({ ...valid, email: "not-an-email" });
    expect(errors.some((e) => e.property === "email")).toBe(true);
  });

  it("rejects a missing consent version", async () => {
    const { consentVersion: _omit, ...withoutConsent } = valid;
    const errors = await validateInput(withoutConsent);
    expect(errors.some((e) => e.property === "consentVersion")).toBe(true);
  });
});
