import { createHash } from "node:crypto";

/**
 * Deterministic, RFC 4122-valid **version 4** UUID for a stable label.
 *
 * Seeds need stable ids (re-running must upsert, never duplicate), so the id
 * is derived from an MD5 hash of the label. But the API validates incoming
 * ids with `@IsUUID("4")` — a raw hash formatted as a UUID is only accepted
 * by chance (~1 in 64), which made seeded quizzes/assignments impossible to
 * start or submit. Setting the version nibble to 4 and the variant bits to
 * 10xx makes every id a valid v4 UUID while staying deterministic.
 *
 * Not a security boundary — fixture data only.
 */
export function deterministicUuid(namespace: string, label: string): string {
  const h = createHash("md5").update(`${namespace}:${label}`).digest("hex");
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
