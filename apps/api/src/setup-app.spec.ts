import type { INestApplication } from "@nestjs/common";
import { configureApp } from "./setup-app";

function fakeApp(appConfig: Record<string, unknown>): INestApplication {
  return {
    get: () => ({ getOrThrow: () => appConfig }),
    use: jest.fn(),
    enableCors: jest.fn(),
    setGlobalPrefix: jest.fn(),
    useGlobalPipes: jest.fn(),
  } as unknown as INestApplication;
}

describe("configureApp", () => {
  it("refuses to boot in production with no CORS_ORIGINS configured (fail fast, not fail open)", () => {
    const app = fakeApp({ globalPrefix: "api/v1", corsOrigins: [], nodeEnv: "production" });
    expect(() => configureApp(app)).toThrow(/CORS_ORIGINS must be set in production/);
  });

  it("boots in production when CORS_ORIGINS is configured", () => {
    const app = fakeApp({
      globalPrefix: "api/v1",
      corsOrigins: ["https://app.examora.test"],
      nodeEnv: "production",
    });
    expect(() => configureApp(app)).not.toThrow();
    expect(app.enableCors).toHaveBeenCalledWith({
      origin: ["https://app.examora.test"],
      credentials: true,
    });
  });

  it("falls back to reflect-any-origin outside production for developer convenience", () => {
    const app = fakeApp({ globalPrefix: "api/v1", corsOrigins: [], nodeEnv: "development" });
    expect(() => configureApp(app)).not.toThrow();
    expect(app.enableCors).toHaveBeenCalledWith({ origin: true, credentials: true });
  });
});
