import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/setup-app";

/**
 * Sprint 13 production-readiness hardening: no rate limiting existed
 * anywhere before this (login/register were fully open to brute-force).
 * Every other e2e spec runs with NODE_ENV=test, under which
 * `shouldSkipThrottling()` deliberately disables enforcement (see
 * rate-limit.config.ts) — hundreds of rapid-fire requests per spec file from
 * the same loopback address would otherwise trip any real-world-sized limit
 * and have nothing to do with genuine abuse. This spec is the one place that
 * flips NODE_ENV back to a non-test value around a request burst, so the
 * real throttling behavior (not just its configuration) is proven by the
 * automated suite rather than only manually verified.
 */
describe("Rate limiting (e2e)", () => {
  let app: INestApplication;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
  }, 30_000);

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await app.close();
  });

  it("throttles a burst of login attempts past the configured limit (5/60s) with 429", async () => {
    process.env.NODE_ENV = "production";
    try {
      const email = `rate-limit-${Date.now()}@example.test`;
      const responses = [];
      for (let i = 0; i < 6; i++) {
        responses.push(
          await request(app.getHttpServer())
            .post("/api/v1/auth/login")
            .send({ email, password: "wrong-password-123" }),
        );
      }
      const statuses = responses.map((r) => r.status);
      // First 5 are rejected on credentials (401), not on rate — only the 6th
      // is throttled. Proves the limit is 5, not that everything just fails.
      expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(statuses[5]).toBe(429);
    } finally {
      process.env.NODE_ENV = "production"; // restored again in afterAll
    }
  });

  it("does not throttle unrelated endpoints at the same low threshold (global limit is much higher)", async () => {
    process.env.NODE_ENV = "production";
    try {
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer()).get("/health/live").expect(200);
      }
    } finally {
      process.env.NODE_ENV = "production";
    }
  });
});
