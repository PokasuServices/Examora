import { Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { AppConfig } from "../config/configuration";
import { BULLMQ_REDIS_CLIENT, REDIS_CLIENT } from "./redis.constants";
import { RedisShutdownService } from "./redis-shutdown.service";

const logger = new Logger("RedisModule");

/**
 * Local/native dev (no Docker, Redis not installed) must not spam the log
 * with a raw ioredis stack trace on every retry, or risk crashing the
 * process via an unhandled 'error' event — ioredis keeps retrying
 * indefinitely by design (Redis coming back later should self-heal with no
 * restart needed), so this only bounds the *logging* to one line per
 * connect/disconnect transition, not the retries themselves. BullMQ jobs,
 * cache, and rate-limit counters degrade/queue rather than the app failing
 * to boot — Postgres is the only hard boot dependency (PrismaModule).
 */
function attachConnectionLogging(client: Redis, label: string): void {
  let lastLoggedDown = false;
  client.on("error", (error: Error) => {
    if (!lastLoggedDown) {
      lastLoggedDown = true;
      logger.warn(
        `${label}: Redis unreachable (${error.message}) — retrying in the background. ` +
          "BullMQ jobs, cache, and rate-limit counters are degraded until it reconnects.",
      );
    }
  });
  client.on("ready", () => {
    if (lastLoggedDown) {
      lastLoggedDown = false;
      logger.log(`${label}: Redis connected.`);
    }
  });
}

/**
 * Global Redis connections (BACKEND-19 §5: sessions, cache, rate-limit
 * counters; Sprint 5 adds a dedicated BullMQ connection). Sprint 0 wired the
 * general-purpose connection only — caching strategy per module lands as
 * each feature needs it.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const { redis } = configService.getOrThrow<AppConfig>("app");
        const client = new Redis(redis.url, { maxRetriesPerRequest: 3 });
        attachConnectionLogging(client, "REDIS_CLIENT");
        return client;
      },
    },
    {
      // BullMQ requires maxRetriesPerRequest: null, incompatible with
      // REDIS_CLIENT's settings above, so it gets its own connection.
      provide: BULLMQ_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const { redis } = configService.getOrThrow<AppConfig>("app");
        const client = new Redis(redis.url, { maxRetriesPerRequest: null });
        attachConnectionLogging(client, "BULLMQ_REDIS_CLIENT");
        return client;
      },
    },
    RedisShutdownService,
  ],
  exports: [REDIS_CLIENT, BULLMQ_REDIS_CLIENT],
})
export class RedisModule {}
