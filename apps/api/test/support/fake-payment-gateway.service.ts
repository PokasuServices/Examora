import * as crypto from "node:crypto";
import { Injectable } from "@nestjs/common";
import type {
  GatewayOrder,
  PaymentGatewayPort,
  WebhookEvent,
} from "../../src/commerce/payment-gateway.port";

/**
 * Test double for PAYMENT_GATEWAY_PORT (ADR-0018) — no real Razorpay account
 * required. Computes the same HMAC-SHA256 algorithm the real adapter uses,
 * against a fixed test secret, so tests exercise the real signature-
 * verification logic end-to-end rather than bypassing it (mirrors the
 * EICAR-string philosophy from Sprint 5's malware-scan tests).
 */
@Injectable()
export class FakePaymentGatewayService implements PaymentGatewayPort {
  static readonly TEST_WEBHOOK_SECRET = "fake-webhook-secret-for-tests";
  private counter = 0;

  async createOrder(): Promise<GatewayOrder> {
    await Promise.resolve();
    this.counter += 1;
    return { gatewayOrderId: `fake_order_${this.counter}_${Date.now()}` };
  }

  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string): boolean {
    const expected = crypto
      .createHmac("sha256", FakePaymentGatewayService.TEST_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    return expected === signatureHeader;
  }

  parseWebhookEvent(rawBody: Buffer | string): WebhookEvent {
    return JSON.parse(rawBody.toString()) as WebhookEvent;
  }

  /** Test-only helper: builds a valid signed webhook body + signature pair. */
  static sign(event: WebhookEvent): { rawBody: string; signature: string } {
    const rawBody = JSON.stringify(event);
    const signature = crypto
      .createHmac("sha256", FakePaymentGatewayService.TEST_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    return { rawBody, signature };
  }
}
