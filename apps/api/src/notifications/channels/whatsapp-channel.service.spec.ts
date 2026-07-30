import type { ConfigService } from "@nestjs/config";
import { WhatsAppChannelService } from "./whatsapp-channel.service";

function buildConfigService(configured: boolean, whatsappFrom = ""): ConfigService {
  return {
    getOrThrow: () => ({
      notifications: {
        twilio: { configured, accountSid: "", authToken: "", smsFrom: "", whatsappFrom },
      },
    }),
  } as unknown as ConfigService;
}

describe("WhatsAppChannelService", () => {
  it("logs instead of sending and reports success when Twilio is unconfigured", async () => {
    const service = new WhatsAppChannelService(buildConfigService(false));
    service.onModuleInit();

    const result = await service.send({ to: "+15551234567", body: "Body" });

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toMatch(/^stub-/);
  });

  it("also stays unconfigured when Twilio is on but no WhatsApp sender number is set", async () => {
    const service = new WhatsAppChannelService(buildConfigService(true, ""));
    service.onModuleInit();

    const result = await service.send({ to: "+15551234567", body: "Body" });

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toMatch(/^stub-/);
  });
});
