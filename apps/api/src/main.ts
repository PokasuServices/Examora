import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import type { AppConfig } from "./config/configuration";
import { configureApp } from "./setup-app";

async function bootstrap(): Promise<void> {
  // NODE_ENV=test disables rate limiting entirely (common/rate-limit.config.ts
  // shouldSkipThrottling) — that's correct for the automated test suite, which
  // never runs this file (jest calls Test.createTestingModule() directly, both
  // `test` and `test:e2e` package.json scripts invoke jest, never `node
  // dist/main.js`). A real deployment accidentally started with NODE_ENV=test
  // would silently boot with zero brute-force/credential-stuffing protection —
  // fail loudly here instead.
  if (process.env.NODE_ENV === "test") {
    throw new Error(
      "Refusing to start: NODE_ENV=test disables rate limiting and is reserved for the " +
        "automated test suite, which never runs this entrypoint. Set NODE_ENV to " +
        "'production' (or leave unset for local development).",
    );
  }

  // rawBody: true (ADR-0018) — preserves the exact request bytes on
  // req.rawBody alongside the parsed JSON body, needed for the payments
  // webhook's HMAC signature verification (re-serializing the parsed JSON
  // would not byte-for-byte match what the gateway actually signed).
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  configureApp(app);

  const configService = app.get(ConfigService);
  const { port } = configService.getOrThrow<AppConfig>("app");

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Examora API")
    .setDescription("Examora platform API contract — authoritative source per ADR-0002")
    .setVersion("0.0.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(port);
}

void bootstrap();
