import { expiresAtFromNow, generateOpaqueToken, hashToken } from "./refresh-token.util";

describe("refresh-token.util", () => {
  it("generates a high-entropy opaque token", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toEqual(b);
    expect(a).toHaveLength(96);
  });

  it("hashes deterministically", () => {
    const token = generateOpaqueToken();
    expect(hashToken(token)).toEqual(hashToken(token));
    expect(hashToken(token)).not.toEqual(token);
  });

  it("computes a future expiry from a duration string", () => {
    const before = Date.now();
    const expiry = expiresAtFromNow("30d");
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + thirtyDaysMs - 1000);
  });
});
