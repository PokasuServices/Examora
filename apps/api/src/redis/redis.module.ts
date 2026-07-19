import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { AppConfig } from "../config/configuration";
import { REDIS_CLIENT } from "./redis.constants";
import { RedisShutdownService } from "./redis-shutdown.service";

/**
 * Global Redis connection (BACKEND-19 §5: sessions, cache, rate-limit
 * counters). Sprint 0 wires the connection only — caching strategy per
 * module lands as each feature needs it.
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
    RedisShutdownService,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
