import type { MiddlewareConsumer, NestModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import type Redis from "ioredis";
import { LoggerModule } from "nestjs-pino";
import { generateCorrelationId } from "@examora/utils";
import configuration from "./config/configuration";
import { validateEnv } from "./config/env.validation";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { BULLMQ_REDIS_CLIENT } from "./redis/redis.constants";
import { StorageModule } from "./storage/storage.module";
import { MalwareScanModule } from "./malware-scan/malware-scan.module";
import { HealthModule } from "./health/health.module";
import { NotificationModule } from "./notifications/notification.module";
import { AuditModule } from "./audit/audit.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { AdminModule } from "./admin/admin.module";
import { ContentModule } from "./content/content.module";
import { LearningModule } from "./learning/learning.module";
import { AssessmentModule } from "./assessment/assessment.module";
import { AssignmentsModule } from "./assignments/assignments.module";
import { MentoringModule } from "./mentoring/mentoring.module";
import { CommunityModule } from "./community/community.module";
import { EnrollmentModule } from "./enrollment/enrollment.module";
import { CommerceModule } from "./commerce/commerce.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
      load: [configuration],
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        transport:
          process.env.NODE_ENV === "production"
            ? undefined
            : { target: "pino-pretty", options: { singleLine: true } },
        genReqId: (req): string => {
          const header = req.headers["x-correlation-id"];
          if (typeof header === "string" && header.length > 0) return header;
          if (Array.isArray(header) && header.length > 0) return header[0]!;
          return generateCorrelationId();
        },
        redact: ["req.headers.authorization", "req.headers.cookie"],
      },
    }),
    // Reuses RedisModule's BULLMQ_REDIS_CLIENT (maxRetriesPerRequest: null,
    // required by BullMQ — incompatible with REDIS_CLIENT's settings) so the
    // connection has a single owner with a proper shutdown hook
    // (RedisShutdownService). An inline `new Redis(...)` here would create an
    // untracked connection that never closes, leaving Jest/the process
    // hanging after app.close().
    BullModule.forRootAsync({
      inject: [BULLMQ_REDIS_CLIENT],
      useFactory: (bullmqRedis: Redis) => ({ connection: bullmqRedis }),
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    MalwareScanModule,
    NotificationModule,
    AuditModule,
    PermissionsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    AdminModule,
    ContentModule,
    LearningModule,
    AssessmentModule,
    AssignmentsModule,
    MentoringModule,
    CommunityModule,
    EnrollmentModule,
    CommerceModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
