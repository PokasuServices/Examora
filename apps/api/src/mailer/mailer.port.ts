export const MAILER_PORT = "MAILER_PORT";

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
}

/**
 * Outbound-email seam (ADR-0009). Auth flows (verification, password reset)
 * need to send email NOW, but the real Notification Service (COMM-MERGED,
 * multi-channel templates, delivery tracking) is Sprint 9 — this interface
 * is the boundary so Sprint 9 only has to swap the implementation, never the
 * call sites in AuthService.
 */
export interface MailerPort {
  send(params: SendEmailParams): Promise<void>;
}
