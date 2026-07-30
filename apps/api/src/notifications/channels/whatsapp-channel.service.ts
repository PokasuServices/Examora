import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Twilio from "twilio";
import type { AppConfig } from "../../config/configuration";
import type { ChannelSendResult, WhatsAppChannelPort } from "../ports/channel-sender.port";

/**
 * Real adapter: Twilio's WhatsApp Business API channel (ADR-0005/0019
 * default) — same Twilio client as SMS, `whatsapp:` prefix on from/to per
 * Twilio's API. Logs instead of sending when unconfigured.
 */
@Injectable()
export class WhatsAppChannelService implements WhatsAppChannelPort, OnModuleInit {
  private readonly logger = new Logger(WhatsAppChannelService.name);
  private client: ReturnType<typeof Twilio> | null = null;
  private whatsappFrom = "";

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const { twilio } = this.configService.getOrThrow<AppConfig>("app").notifications;
    this.whatsappFrom = twilio.whatsappFrom;
    if (twilio.configured && twilio.whatsappFrom.length > 0) {
      this.client = Twilio(twilio.accountSid, twilio.authToken);
    } else {
      this.logger.warn("Twilio WhatsApp not configured — messages will be logged, not sent");
    }
  }

  async send(params: { to: string; body: string }): Promise<ChannelSendResult> {
    if (!this.client) {
      this.logger.warn(`[stub-whatsapp] to=${params.to}\n${params.body}`);
      return { success: true, providerMessageId: `stub-${Date.now()}` };
    }

    try {
      const message = await this.client.messages.create({
        to: `whatsapp:${params.to}`,
        from: `whatsapp:${this.whatsappFrom}`,
        body: params.body,
      });
      return { success: true, providerMessageId: message.sid };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
