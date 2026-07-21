import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { AppConfig } from "../config/configuration";
import { BULLMQ_REDIS_CLIENT, REDIS_CLIENT } from "./redis.constants";
import { RedisShutdownService } from "./redis-shutdown.service";

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
        return new Redis(redis.url, { maxRetriesPerRequest: 3 });
      },
    },
    {
      // BullMQ requires maxRetriesPerRequest: null, incompatible with
      // REDIS_CLIENT's settings above, so it gets its own connection.
      provide: BULLMQ_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const { redis } = configService.getOrThrow<AppConfig>("app");
        return new Redis(redis.url, { maxRetriesPerRequest: null });
      },
    },
    RedisShutdownService,
  ],
  exports: [REDIS_CLIENT, BULLMQ_REDIS_CLIENT],
})
export class RedisModule {}
