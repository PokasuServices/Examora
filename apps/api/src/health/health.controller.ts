import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
// NOTE: constructor-injected classes must stay VALUE imports — see TD-011.
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from "@nestjs/terminus";
import { Public } from "../common/decorators/public.decorator";
import { PrismaHealthIndicator } from "./indicators/prisma.health";
import { RedisHealthIndicator } from "./indicators/redis.health";

/**
 * Liveness/readiness endpoints (DEVOPS-14 §6, Sprint 0 exit checklist).
 * All public — health checks must not require authentication.
 *
 * Disk-space checking is deliberately omitted: `check-disk-space` (used by
 * Terminus's DiskHealthIndicator) behaves inconsistently across Windows dev
 * environments vs. Linux containers. Revisit once deployment targets a
 * fixed Linux container filesystem (see docs/TECHNICAL_DEBT_REGISTER.md).
 */
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaIndicator.isHealthy("database"),
      () => this.redisIndicator.isHealthy("redis"),
      () => this.memory.checkHeap("memory_heap", 300 * 1024 * 1024),
    ]);
  }

  /** Liveness: process is up. Must never depend on external services. */
  @Public()
  @Get("live")
  live(): { status: string } {
    return { status: "ok" };
  }

  /** Readiness: dependencies (DB, Redis) are reachable. */
  @Public()
  @Get("ready")
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prismaIndicator.isHealthy("database"),
      () => this.redisIndicator.isHealthy("redis"),
    ]);
  }
}
