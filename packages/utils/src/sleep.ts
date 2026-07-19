/** Promise-based delay, primarily for retry/backoff logic (BACKEND-19 §8). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
