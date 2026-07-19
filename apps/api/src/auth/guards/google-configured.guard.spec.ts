import { ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { GoogleConfiguredGuard } from "./google-configured.guard";

function buildConfigService(configured: boolean): ConfigService {
  return {
    getOrThrow: () => ({ oauth: { google: { configured } } }),
  } as unknown as ConfigService;
}

describe("GoogleConfiguredGuard", () => {
  it("allows the request when Google OAuth credentials are configured", () => {
    const guard = new GoogleConfiguredGuard(buildConfigService(true));
    expect(guard.canActivate({} as never)).toBe(true);
  });

  it("throws a 503 when Google OAuth credentials are not configured", () => {
    const guard = new GoogleConfiguredGuard(buildConfigService(false));
    expect(() => guard.canActivate({} as never)).toThrow(ServiceUnavailableException);
  });
});
