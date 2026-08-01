import { BadRequestException } from "@nestjs/common";
import { assertValidCmsTransition } from "./cms-workflow.util";

describe("assertValidCmsTransition", () => {
  it("allows the forward path: Draft -> Review -> Approval -> Publish -> Archive", () => {
    expect(() => assertValidCmsTransition("DRAFT", "IN_REVIEW")).not.toThrow();
    expect(() => assertValidCmsTransition("IN_REVIEW", "APPROVED")).not.toThrow();
    expect(() => assertValidCmsTransition("APPROVED", "PUBLISHED")).not.toThrow();
    expect(() => assertValidCmsTransition("PUBLISHED", "ARCHIVED")).not.toThrow();
  });

  it("allows sending content back to draft from review or approval", () => {
    expect(() => assertValidCmsTransition("IN_REVIEW", "DRAFT")).not.toThrow();
    expect(() => assertValidCmsTransition("APPROVED", "DRAFT")).not.toThrow();
  });

  it("allows DRAFT -> ARCHIVED directly (discarding an unpublished draft)", () => {
    expect(() => assertValidCmsTransition("DRAFT", "ARCHIVED")).not.toThrow();
  });

  it("allows restoring archived content back to draft", () => {
    expect(() => assertValidCmsTransition("ARCHIVED", "DRAFT")).not.toThrow();
  });

  it("rejects skipping straight from DRAFT to PUBLISHED", () => {
    expect(() => assertValidCmsTransition("DRAFT", "PUBLISHED")).toThrow(BadRequestException);
  });

  it("rejects publishing directly from IN_REVIEW (approval must come first)", () => {
    expect(() => assertValidCmsTransition("IN_REVIEW", "PUBLISHED")).toThrow(BadRequestException);
  });

  it("rejects ARCHIVED -> PUBLISHED (must be restored to draft and re-approved first)", () => {
    expect(() => assertValidCmsTransition("ARCHIVED", "PUBLISHED")).toThrow(BadRequestException);
  });

  it("rejects PUBLISHED -> DRAFT (must go through Archive to restart the workflow)", () => {
    expect(() => assertValidCmsTransition("PUBLISHED", "DRAFT")).toThrow(BadRequestException);
  });
});
