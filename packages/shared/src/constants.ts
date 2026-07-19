/** API versioning per MDG-00 §11 / API-17 §2. */
export const API_VERSION = "v1";
export const API_PREFIX = `api/${API_VERSION}`;

export const APP_NAME = "Examora";

/** Header names used across the API contract (API-17 §4). */
export const HEADER_IDEMPOTENCY_KEY = "Idempotency-Key";
export const HEADER_CORRELATION_ID = "X-Correlation-ID";

/**
 * Current Terms of Service version presented at registration (FR-PROFILE-01
 * consent capture). Bump this when the ToS changes — existing users are
 * re-prompted to accept the new version in a later sprint's consent-refresh flow.
 */
export const CURRENT_TERMS_VERSION = "v1.0";
