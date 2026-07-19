import { Inject, Injectable } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthCheckError } from "@nestjs/terminus";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "../../redis/redis.constants";

@Injectable()
export class RedisHealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const reply = await this.redis.ping();
      if (reply !== "PONG") {
        throw new Error(`Unexpected PING reply: ${reply}`);
      }
      return { [key]: { status: "up" } };
    } catch (error) {
      throw new HealthCheckError("Redis health check failed", {
        [key]: { status: "down", message: (error as Error).message },
      });
    }
  }
}
