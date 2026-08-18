import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import type { AppConfig } from "./config/configuration";
import { configureApp } from "./setup-app";

// Local/native dev without Redis running: ioredis flushes its offline command
// queue on every connection drop, individually rejecting each in-flight
// command (mainly BullMQ's own internal polling/heartbeat commands) — none
// of those rejections are caught anywhere in application code, since they
// originate deep inside ioredis/BullMQ, not our own call sites. Left
// unhandled, Node prints each one as its own raw, un-throttled stack trace;
// redis.module.ts's connection logging only covers the client's own 'error'
// event, a different code path from per-command rejections. Throttle exactly
// these. Attaching this listener also suppresses Node's default
// crash-on-unhandled-rejection behavior for every other case, so a genuine
// (non-Redis) unhandled rejection is deliberately still logged in full —
// never silently swallowed — but intentionally does NOT force-exit: under
// `nest start --watch`, a transient EADDRINUSE while the old process is
// still releasing the port during hot-reload is a normal, self-resolving
// unhandled rejection too, and would otherwise kill the watcher outright.
let loggedRedisRejection = false;
process.on("unhandledRejection", (reason: unknown) => {
  const stack = reason instanceof Error ? (reason.stack ?? "") : "";
  if (stack.includes("ioredis")) {
    if (!loggedRedisRejection) {
      loggedRedisRejection = true;
      console.warn(
        "[Redis] a queued command was rejected because the connection is down " +
          "(further occurrences suppressed until it reconnects).",
      );
    }
    return;
  }
  console.error("Unhandled promise rejection:", reason);
});

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
