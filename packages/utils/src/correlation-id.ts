import { randomUUID } from "node:crypto";

/** Generates a correlation ID for request tracing (API-17 §4, MDG-00 §11). */
export function generateCorrelationId(): string {
  return randomUUID();
}
