import type { ConfigService } from "@nestjs/config";
import { WebPushChannelService } from "./web-push-channel.service";

function buildConfigService(configured: boolean): ConfigService {
  return {
    getOrThrow: () => ({
      notifications: {
        webPush: {
          configured,
          publicKey: "",
          privateKey: "",
          subject: "mailto:admin@example.test",
        },
      },
    }),
  } as unknown as ConfigService;
}

describe("WebPushChannelService", () => {
  it("logs instead of sending and reports success when VAPID keys are unconfigured", async () => {
    const service = new WebPushChannelService(buildConfigService(false));
    service.onModuleInit();

    const result = await service.send({
      subscription: { endpoint: "https://push.example.test/x", p256dh: "p", auth: "a" },
      title: "Hi",
      body: "Body",
    });

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toMatch(/^stub-/);
  });
});
