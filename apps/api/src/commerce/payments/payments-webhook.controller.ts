import { Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { PaymentsService } from "./payments.service";

/**
 * The gateway calls this directly — no user session exists (ADR-0018).
 * @Public() bypasses JwtAuthGuard; this controller carries no
 * @RequirePermissions anywhere, so PermissionsGuard is a no-op for it too.
 * Authorization instead comes entirely from the mandatory HMAC signature
 * check inside PaymentsService.handleWebhook (SRS-02 Table 6).
 */
@ApiExcludeController()
@Controller("commerce/payments")
export class PaymentsWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("webhook")
  @Public()
  @HttpCode(HttpStatus.OK)
  async webhook(@Req() req: RawBodyRequest<Request>): Promise<{ received: boolean }> {
    const signature = req.headers["x-razorpay-signature"];
    await this.paymentsService.handleWebhook(
      req.rawBody ?? Buffer.from(""),
      typeof signature === "string" ? signature : undefined,
    );
    return { received: true };
  }
}
