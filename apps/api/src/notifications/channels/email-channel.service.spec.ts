import type { ConfigService } from "@nestjs/config";
import { EmailChannelService } from "./email-channel.service";

function buildConfigService(configured: boolean): ConfigService {
  return {
    getOrThrow: () => ({
      notifications: {
        ses: {
          configured,
          region: "us-east-1",
          accessKeyId: "",
          secretAccessKey: "",
          fromEmail: "noreply@example.test",
        },
      },
    }),
  } as unknown as ConfigService;
}

describe("EmailChannelService", () => {
  it("logs instead of sending and reports success when SES is unconfigured", async () => {
    const service = new EmailChannelService(buildConfigService(false));
    service.onModuleInit();

    const result = await service.send({ to: "a@example.test", subject: "Hi", body: "Body" });

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toMatch(/^stub-/);
  });
});
