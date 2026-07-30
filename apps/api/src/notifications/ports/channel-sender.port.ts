/**
 * One port per channel (ADR-0019 §6) — Email/SMS/WhatsApp/Web Push have
 * genuinely different addressing (email address vs. phone vs. a push-
 * subscription object), mirroring why PaymentGatewayPort is Razorpay-shaped
 * rather than a single generic interface.
 *
 * Every real adapter follows the ConsoleMailerService/Razorpay "configured"
 * precedent — but unlike payments, an unconfigured notification channel logs
 * and reports success rather than throwing: no money is on the line, and the
 * whole delivery pipeline (queue, retry, delivery-state tracking, in-app
 * center) must stay fully exercisable in tests without real vendor
 * credentials.
 */
export interface ChannelSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export const EMAIL_CHANNEL_PORT = "EMAIL_CHANNEL_PORT";
export interface EmailChannelPort {
  send(params: { to: string; subject: string; body: string }): Promise<ChannelSendResult>;
}

export const SMS_CHANNEL_PORT = "SMS_CHANNEL_PORT";
export interface SmsChannelPort {
  send(params: { to: string; body: string }): Promise<ChannelSendResult>;
}

export const WHATSAPP_CHANNEL_PORT = "WHATSAPP_CHANNEL_PORT";
export interface WhatsAppChannelPort {
  send(params: { to: string; body: string }): Promise<ChannelSendResult>;
}

export const WEB_PUSH_CHANNEL_PORT = "WEB_PUSH_CHANNEL_PORT";
export interface WebPushChannelPort {
  send(params: {
    subscription: { endpoint: string; p256dh: string; auth: string };
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<ChannelSendResult>;
}

/**
 * Interface-only (ADR-0004/0019 §6) — Mobile Push is tied to a native app,
 * a PRD-01 §9 non-goal for this release. No real fan-out logic ever selects
 * this channel today; the stub implementation exists purely so the shape is
 * ready for a real adapter later without an interface change.
 */
export const MOBILE_PUSH_CHANNEL_PORT = "MOBILE_PUSH_CHANNEL_PORT";
export interface MobilePushChannelPort {
  send(params: { deviceToken: string; title: string; body: string }): Promise<ChannelSendResult>;
}
