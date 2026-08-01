import type { ThrottlerModuleOptions } from "@nestjs/throttler";

/**
 * Sprint 13 production-readiness hardening — no rate limiting existed
 * anywhere in the app before this (every endpoint, including login/register,
 * was fully open to brute-force/credential-stuffing/scraping).
 *
 * Skipped when NODE_ENV=test: supertest-driven e2e specs make hundreds of
 * requests per file from the same loopback address with no artificial delay,
 * which would trip any real-world-sized limit almost immediately and has
 * nothing to do with genuine abuse — mirrors how GoogleConfiguredGuard and
 * every notification channel adapter already special-case their environment
 * rather than being exercised identically everywhere. The real behavior is
 * manually verified (see Sprint 13 Security Review), not covered by the
 * automated suite.
 */
export function shouldSkipThrottling(): boolean {
  return process.env.NODE_ENV === "test";
}

/** Global default: generous enough for normal dashboard/admin usage, tight enough to block sustained scraping. */
export const THROTTLER_OPTIONS: ThrottlerModuleOptions = [
  {
    name: "default",
    ttl: 60_000,
    limit: 100,
    skipIf: shouldSkipThrottling,
  },
];
