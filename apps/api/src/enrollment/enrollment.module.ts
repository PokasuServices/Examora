import { Module } from "@nestjs/common";
import { AdminEnrollmentController } from "./admin-enrollment.controller";
import { EnrollmentController } from "./enrollment.controller";
import { EnrollmentService } from "./enrollment.service";

/**
 * Sprint 8 (ADR-0018): a "base" module like Learning/Assessment/Assignments/
 * Users — no cross-feature imports of its own, specifically so Learning/
 * Assessment/Assignments (which need to *check* an enrollment) and
 * CommerceModule (which needs to *create* one on payment success) can both
 * depend on it without forming a cycle.
 */
@Module({
  controllers: [EnrollmentController, AdminEnrollmentController],
  providers: [EnrollmentService],
  exports: [EnrollmentService],
})
export class EnrollmentModule {}
