import { shouldSkipThrottling, THROTTLER_OPTIONS } from "./rate-limit.config";

describe("rate-limit.config", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("shouldSkipThrottling", () => {
    it("skips throttling when NODE_ENV=test (the automated suite's environment)", () => {
      process.env.NODE_ENV = "test";
      expect(shouldSkipThrottling()).toBe(true);
    });

    it("does not skip throttling in development", () => {
      process.env.NODE_ENV = "development";
      expect(shouldSkipThrottling()).toBe(false);
    });

    it("does not skip throttling in production", () => {
      process.env.NODE_ENV = "production";
      expect(shouldSkipThrottling()).toBe(false);
    });
  });

  it("configures a single named throttler with a sane global default", () => {
    const [config] = THROTTLER_OPTIONS as Array<{ name: string; ttl: number; limit: number }>;
    expect(config.name).toBe("default");
    expect(config.limit).toBeGreaterThan(0);
    expect(config.ttl).toBeGreaterThan(0);
  });
});
