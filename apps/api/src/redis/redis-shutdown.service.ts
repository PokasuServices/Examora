import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";

/**
 * Closes the shared Redis connection on shutdown (BACKEND-19 §8 "graceful
 * shutdown"). A separate class because the client itself is a plain factory
 * provider with no lifecycle hooks of its own.
 */
@Injectable()
export class RedisShutdownService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
