import type { ConfigService } from "@nestjs/config";
import { SmsChannelService } from "./sms-channel.service";

function buildConfigService(configured: boolean): ConfigService {
  return {
    getOrThrow: () => ({
      notifications: {
        twilio: {
          configured,
          accountSid: "",
          authToken: "",
          smsFrom: "+10000000000",
          whatsappFrom: "",
        },
      },
    }),
  } as unknown as ConfigService;
}

describe("SmsChannelService", () => {
  it("logs instead of sending and reports success when Twilio is unconfigured", async () => {
    const service = new SmsChannelService(buildConfigService(false));
    service.onModuleInit();

    const result = await service.send({ to: "+15551234567", body: "Body" });

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toMatch(/^stub-/);
  });
});
