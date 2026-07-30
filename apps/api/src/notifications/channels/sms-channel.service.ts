import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Twilio from "twilio";
import type { AppConfig } from "../../config/configuration";
import type { ChannelSendResult, SmsChannelPort } from "../ports/channel-sender.port";

/** Real adapter: Twilio SMS (ADR-0005/0019 default). Logs instead of sending when unconfigured. */
@Injectable()
export class SmsChannelService implements SmsChannelPort, OnModuleInit {
  private readonly logger = new Logger(SmsChannelService.name);
  private client: ReturnType<typeof Twilio> | null = null;
  private smsFrom = "";

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const { twilio } = this.configService.getOrThrow<AppConfig>("app").notifications;
    this.smsFrom = twilio.smsFrom;
    if (twilio.configured) {
      this.client = Twilio(twilio.accountSid, twilio.authToken);
    } else {
      this.logger.warn("Twilio not configured — SMS messages will be logged, not sent");
    }
  }

  async send(params: { to: string; body: string }): Promise<ChannelSendResult> {
    if (!this.client) {
      this.logger.warn(`[stub-sms] to=${params.to}\n${params.body}`);
      return { success: true, providerMessageId: `stub-${Date.now()}` };
    }

    try {
      const message = await this.client.messages.create({
        to: params.to,
        from: this.smsFrom,
        body: params.body,
      });
      return { success: true, providerMessageId: message.sid };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
