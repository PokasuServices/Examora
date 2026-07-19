import { createHash, randomBytes } from "node:crypto";
import ms from "ms";

/** Opaque refresh token — the value sent to the client and stored in the cookie. */
export function generateOpaqueToken(): string {
  return randomBytes(48).toString("hex");
}

/**
 * Deterministic hash for DB lookup (ADR-0006). Refresh tokens use SHA-256,
 * not Argon2/bcrypt: they're high-entropy random values looked up by exact
 * match, not low-entropy secrets verified by comparison — a slow salted hash
 * would only add cost with no security benefit here.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function expiresAtFromNow(duration: string): Date {
  return new Date(Date.now() + ms(duration));
}
