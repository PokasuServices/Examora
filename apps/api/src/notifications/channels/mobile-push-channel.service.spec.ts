import { MobilePushChannelService } from "./mobile-push-channel.service";

describe("MobilePushChannelService", () => {
  it("always reports failure — no live integration exists yet (ADR-0019 §6)", async () => {
    const service = new MobilePushChannelService();
    const result = await service.send();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no live integration/i);
  });
});
