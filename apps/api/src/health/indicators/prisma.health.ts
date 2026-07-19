import { Injectable } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthCheckError } from "@nestjs/terminus";
// NOTE: PrismaService is constructor-injected — must stay a VALUE import, see TD-011.
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PrismaHealthIndicator {
  constructor(private readonly prisma: PrismaService) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { [key]: { status: "up" } };
    } catch (error) {
      throw new HealthCheckError("Prisma health check failed", {
        [key]: { status: "down", message: (error as Error).message },
      });
    }
  }
}
