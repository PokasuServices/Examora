import type { INestApplication } from "@nestjs/common";
import { HttpStatus, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { AppConfig } from "./config/configuration";

/**
 * Shared app configuration (global prefix, pipes, security middleware) used
 * by both `main.ts` (real bootstrap) and e2e tests (`Test.createTestingModule`).
 * Keeping this in one place prevents the two from drifting — see TD-012:
 * an earlier version duplicated this logic, and the e2e tests silently never
 * applied the global "/api/v1" prefix, making every auth e2e test 404.
 */
export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const { globalPrefix, corsOrigins, nodeEnv } = configService.getOrThrow<AppConfig>("app");

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // Sprint 13 hardening: an unset CORS_ORIGINS used to fall back to `origin:
  // true` (reflects any origin) unconditionally — fine for local dev (no
  // fixed frontend port list), but a silent wide-open default is exactly the
  // kind of production misconfiguration that should fail loudly at boot
  // instead (same "fail fast on missing config" philosophy as env.validation.ts),
  // not fail open. Non-production keeps the permissive fallback for convenience.
  if (nodeEnv === "production" && corsOrigins.length === 0) {
    throw new Error(
      "CORS_ORIGINS must be set in production — refusing to boot with an open (reflect-any-origin) CORS policy",
    );
  }

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  app.setGlobalPrefix(globalPrefix, { exclude: ["health", "health/live", "health/ready"] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // API-17 §6 specifies 422 for validation errors — Nest defaults to 400.
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );
}
