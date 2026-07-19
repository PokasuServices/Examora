import type { MiddlewareConsumer, NestModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
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
import { HealthModule } from "./health/health.module";
import { MailerModule } from "./mailer/mailer.module";
import { AuditModule } from "./audit/audit.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { AdminModule } from "./admin/admin.module";

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
    PrismaModule,
    RedisModule,
    MailerModule,
    AuditModule,
    PermissionsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    AdminModule,
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
