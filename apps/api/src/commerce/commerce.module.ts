import { Module } from "@nestjs/common";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { AdminOrdersController } from "./orders/admin-orders.controller";
import { CouponsController } from "./coupons/coupons.controller";
import { CouponsService } from "./coupons/coupons.service";
import { OrdersController } from "./orders/orders.controller";
import { OrdersService } from "./orders/orders.service";
import { PAYMENT_GATEWAY_PORT } from "./payment-gateway.port";
import { AdminRefundsController } from "./refunds/admin-refunds.controller";
import { RefundsController } from "./refunds/refunds.controller";
import { RefundsService } from "./refunds/refunds.service";
import { InvoicesController } from "./invoices/invoices.controller";
import { InvoicesService } from "./invoices/invoices.service";
import { PaymentsController } from "./payments/payments.controller";
import { PaymentsService } from "./payments/payments.service";
import { PaymentsWebhookController } from "./payments/payments-webhook.controller";
import { RazorpayGatewayService } from "./razorpay-gateway.service";

/**
 * Sprint 8 (ADR-0018): coupons, orders/checkout, gateway-agnostic payments
 * (webhook-verified), invoices, and a refund-workflow foundation. Only
 * imports EnrollmentModule (to grant/revoke an Enrollment on payment/refund)
 * — reads Course pricing directly via PrismaService rather than importing
 * LearningModule, so this module has no cross-feature imports of its own
 * (see ADR-0018 for why that matters for the dependency graph).
 */
@Module({
  imports: [EnrollmentModule],
  controllers: [
    CouponsController,
    OrdersController,
    AdminOrdersController,
    PaymentsWebhookController,
    PaymentsController,
    InvoicesController,
    RefundsController,
    AdminRefundsController,
  ],
  providers: [
    CouponsService,
    OrdersService,
    PaymentsService,
    InvoicesService,
    RefundsService,
    { provide: PAYMENT_GATEWAY_PORT, useClass: RazorpayGatewayService },
  ],
})
export class CommerceModule {}
