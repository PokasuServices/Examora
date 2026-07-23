export const PAYMENT_GATEWAY_PORT = "PAYMENT_GATEWAY_PORT";

export interface GatewayOrder {
  gatewayOrderId: string;
}

export interface WebhookEvent {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  /** e.g. "payment.captured" / "payment.failed" — interpreted by PaymentsService. */
  event: string;
}

/**
 * Gateway-agnostic payment abstraction (ADR-0018) — mirrors StoragePort/
 * MalwareScannerPort (ADR-0015). RazorpayGatewayService is the only real
 * adapter today; FakePaymentGatewayService is the test double used by every
 * automated test.
 */
export interface PaymentGatewayPort {
  createOrder(params: { amount: number; currency: string; receipt: string }): Promise<GatewayOrder>;
  /** Server-side signature verification is mandatory (SRS-02 Table 6) — a client callback is never trusted. */
  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string): boolean;
  parseWebhookEvent(rawBody: Buffer | string): WebhookEvent;
}
