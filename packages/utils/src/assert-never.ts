/** Exhaustiveness helper for switch statements over union types (e.g. NotificationState). */
export function assertNever(value: never, context?: string): never {
  throw new Error(`Unhandled case${context ? ` in ${context}` : ""}: ${JSON.stringify(value)}`);
}
