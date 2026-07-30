import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import webpush from "web-push";
import type { AppConfig } from "../../config/configuration";
import type { ChannelSendResult, WebPushChannelPort } from "../ports/channel-sender.port";

/**
 * Real adapter: standard Web Push API (VAPID) — ADR-0019 §6. Unlike SMS/
 * WhatsApp/Email, this needs no paid vendor account, only a VAPID keypair,
 * so it is live-testable in any environment. Logs instead of sending when
 * unconfigured.
 */
@Injectable()
export class WebPushChannelService implements WebPushChannelPort, OnModuleInit {
  private readonly logger = new Logger(WebPushChannelService.name);
  private configured = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const { webPush } = this.configService.getOrThrow<AppConfig>("app").notifications;
    this.configured = webPush.configured;
    if (webPush.configured) {
      webpush.setVapidDetails(webPush.subject, webPush.publicKey, webPush.privateKey);
    } else {
      this.logger.warn("VAPID keys not configured — web push messages will be logged, not sent");
    }
  }

  async send(params: {
    subscription: { endpoint: string; p256dh: string; auth: string };
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<ChannelSendResult> {
    if (!this.configured) {
      this.logger.warn(`[stub-web-push] endpoint=${params.subscription.endpoint}\n${params.title}`);
      return { success: true, providerMessageId: `stub-${Date.now()}` };
    }

    try {
      const result = await webpush.sendNotification(
        {
          endpoint: params.subscription.endpoint,
          keys: { p256dh: params.subscription.p256dh, auth: params.subscription.auth },
        },
        JSON.stringify({ title: params.title, body: params.body, data: params.data ?? {} }),
      );
      return { success: true, providerMessageId: String(result.statusCode) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
