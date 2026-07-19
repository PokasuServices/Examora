import { BadRequestException } from "@nestjs/common";
import { assertValidStatusTransition } from "./content-status.util";

describe("assertValidStatusTransition", () => {
  it("allows no-op transitions (same status)", () => {
    expect(() => assertValidStatusTransition("DRAFT", "DRAFT")).not.toThrow();
    expect(() => assertValidStatusTransition("PUBLISHED", "PUBLISHED")).not.toThrow();
    expect(() => assertValidStatusTransition("ARCHIVED", "ARCHIVED")).not.toThrow();
  });

  it("allows DRAFT -> PUBLISHED and DRAFT -> ARCHIVED", () => {
    expect(() => assertValidStatusTransition("DRAFT", "PUBLISHED")).not.toThrow();
    expect(() => assertValidStatusTransition("DRAFT", "ARCHIVED")).not.toThrow();
  });

  it("allows PUBLISHED -> DRAFT (unpublish) and PUBLISHED -> ARCHIVED", () => {
    expect(() => assertValidStatusTransition("PUBLISHED", "DRAFT")).not.toThrow();
    expect(() => assertValidStatusTransition("PUBLISHED", "ARCHIVED")).not.toThrow();
  });

  it("allows ARCHIVED -> DRAFT (restore)", () => {
    expect(() => assertValidStatusTransition("ARCHIVED", "DRAFT")).not.toThrow();
  });

  it("rejects ARCHIVED -> PUBLISHED (must be restored to draft first)", () => {
    expect(() => assertValidStatusTransition("ARCHIVED", "PUBLISHED")).toThrow(BadRequestException);
  });
});
