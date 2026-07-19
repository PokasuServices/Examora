import { Injectable } from "@nestjs/common";
import type { MailerPort, SendEmailParams } from "../../src/mailer/mailer.port";

/** Test double for MAILER_PORT — captures sent emails instead of logging them. */
@Injectable()
export class TestMailerService implements MailerPort {
  public sent: SendEmailParams[] = [];

  async send(params: SendEmailParams): Promise<void> {
    this.sent.push(params);
    await Promise.resolve();
  }

  /** Extracts the opaque token embedded in the stub email body (see AuthService). */
  latestTokenFor(to: string): string {
    const message = [...this.sent].reverse().find((email) => email.to === to);
    const match = message?.text.match(/token: ([a-f0-9]+)/);
    if (!match?.[1]) {
      throw new Error(`No token found in test mailer for ${to}`);
    }
    return match[1];
  }

  reset(): void {
    this.sent = [];
  }
}
