import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import type { AppConfig } from "../../config/configuration";
import type { ChannelSendResult, EmailChannelPort } from "../ports/channel-sender.port";

/** Real adapter: AWS SES (ADR-0005/0019 default). Logs instead of sending when unconfigured. */
@Injectable()
export class EmailChannelService implements EmailChannelPort, OnModuleInit {
  private readonly logger = new Logger(EmailChannelService.name);
  private client: SESClient | null = null;
  private fromEmail = "";

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const { ses } = this.configService.getOrThrow<AppConfig>("app").notifications;
    this.fromEmail = ses.fromEmail;
    if (ses.configured) {
      this.client = new SESClient({
        region: ses.region,
        credentials: { accessKeyId: ses.accessKeyId, secretAccessKey: ses.secretAccessKey },
      });
    } else {
      this.logger.warn("SES not configured — emails will be logged, not sent");
    }
  }

  async send(params: { to: string; subject: string; body: string }): Promise<ChannelSendResult> {
    if (!this.client) {
      this.logger.warn(`[stub-email] to=${params.to} subject="${params.subject}"\n${params.body}`);
      return { success: true, providerMessageId: `stub-${Date.now()}` };
    }

    try {
      const result = await this.client.send(
        new SendEmailCommand({
          Source: this.fromEmail,
          Destination: { ToAddresses: [params.to] },
          Message: {
            Subject: { Data: params.subject },
            Body: { Text: { Data: params.body } },
          },
        }),
      );
      return { success: true, providerMessageId: result.MessageId };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
