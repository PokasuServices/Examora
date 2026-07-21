export const REDIS_CLIENT = "REDIS_CLIENT";

/** A second, dedicated connection for BullMQ (Sprint 5) — BullMQ requires
 *  maxRetriesPerRequest: null, which REDIS_CLIENT's general-purpose settings
 *  (maxRetriesPerRequest: 3) don't satisfy, so it can't share that connection. */
export const BULLMQ_REDIS_CLIENT = "BULLMQ_REDIS_CLIENT";
