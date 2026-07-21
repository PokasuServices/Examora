import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import type Redis from "ioredis";
import { BULLMQ_REDIS_CLIENT, REDIS_CLIENT } from "./redis.constants";

/**
 * Closes both Redis connections on shutdown (BACKEND-19 §8 "graceful
 * shutdown"). A separate class because the clients themselves are plain
 * factory providers with no lifecycle hooks of their own. Without this,
 * an e2e test's `app.close()` leaves the connections open and Jest never
 * exits (learned the hard way — see TD-024).
 */
@Injectable()
export class RedisShutdownService implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(BULLMQ_REDIS_CLIENT) private readonly bullmqRedis: Redis,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.redis.quit(), this.bullmqRedis.quit()]);
  }
}
