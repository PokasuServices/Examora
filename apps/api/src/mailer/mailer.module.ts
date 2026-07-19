import { Global, Module } from "@nestjs/common";
import { ConsoleMailerService } from "./console-mailer.service";
import { MAILER_PORT } from "./mailer.port";

@Global()
@Module({
  providers: [{ provide: MAILER_PORT, useClass: ConsoleMailerService }],
  exports: [MAILER_PORT],
})
export class MailerModule {}
