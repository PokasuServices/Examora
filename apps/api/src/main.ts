import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import type { AppConfig } from "./config/configuration";
import { configureApp } from "./setup-app";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
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
