import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@examora/database";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Connected to database");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
