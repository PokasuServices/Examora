import { Injectable, Logger } from "@nestjs/common";
import type { MailerPort, SendEmailParams } from "./mailer.port";

/**
 * Sprint 1 placeholder implementation of MailerPort (ADR-0009, TD-013): logs
 * the email instead of sending it. Never used in a real deployment — replaced
 * wholesale by the Notification Service adapter in Sprint 9.
 */
@Injectable()
export class ConsoleMailerService implements MailerPort {
  private readonly logger = new Logger(ConsoleMailerService.name);

  async send(params: SendEmailParams): Promise<void> {
    this.logger.warn(
      `[stub-mailer] would send email to=${params.to} subject="${params.subject}"\n${params.text}`,
    );
    await Promise.resolve();
  }
}
