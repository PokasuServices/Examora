import * as crypto from "node:crypto";
import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Razorpay from "razorpay";
import type { AppConfig } from "../config/configuration";
import type { GatewayOrder, PaymentGatewayPort, WebhookEvent } from "./payment-gateway.port";

/**
 * Real adapter (ADR-0005/0018) — only manually verified against a real
 * Razorpay test account, never exercised by CI (mirrors TD-027's existing
 * S3/ClamAV trade-off; see TD-038). The app boots without real credentials —
 * `createOrder` fails loudly only when actually called while unconfigured.
 */
@Injectable()
export class RazorpayGatewayService implements PaymentGatewayPort, OnModuleInit {
  private readonly logger = new Logger(RazorpayGatewayService.name);
  private client: Razorpay | null = null;
  private webhookSecret = "";

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const { razorpay } = this.configService.getOrThrow<AppConfig>("app").payments;
    this.webhookSecret = razorpay.webhookSecret;
    if (razorpay.configured) {
      this.client = new Razorpay({ key_id: razorpay.keyId, key_secret: razorpay.keySecret });
    } else {
      this.logger.warn("Razorpay not configured — payment order creation will fail until it is");
    }
  }

  async createOrder(params: {
    amount: number;
    currency: string;
    receipt: string;
  }): Promise<GatewayOrder> {
    if (!this.client) {
      throw new ServiceUnavailableException("Payment gateway is not configured");
    }
    const order = await this.client.orders.create({
      amount: Math.round(params.amount * 100),
      currency: params.currency,
      receipt: params.receipt,
    });
    return { gatewayOrderId: order.id };
  }

  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string): boolean {
    const expected = crypto.createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signatureHeader);
    return (
      expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)
    );
  }

  parseWebhookEvent(rawBody: Buffer | string): WebhookEvent {
    const payload = JSON.parse(rawBody.toString()) as {
      event: string;
      payload: { payment: { entity: { id: string; order_id: string } } };
    };
    const entity = payload.payload.payment.entity;
    return { gatewayOrderId: entity.order_id, gatewayPaymentId: entity.id, event: payload.event };
  }
}
