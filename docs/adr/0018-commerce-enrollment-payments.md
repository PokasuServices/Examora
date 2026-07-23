# ADR-0018: Commerce, Enrollment & Payments — Data Model, Module Boundaries, and Access Control

Status: Accepted
Date: 2026-07-22
Deciders: Engineering (Sprint 8)

## Context

Sprint 8 ("Commerce, Enrollment & Payments") delivers course enrollment/access-control/entitlements/
purchase history, commerce (pricing, coupons, discounts, orders, invoices, a refund-workflow
foundation), payments (a gateway-agnostic abstraction, Razorpay as the concrete adapter per ADR-0005,
webhook-verified payment confirmation, payment history, transaction logging), and access-control
integration across Learning, Quiz, Creative Assignments, and Mentor workflows so that only entitled
students reach paid content (D-53). Per the kickoff instruction ("reuse existing modules, do not
duplicate business logic"), this sprint reuses Sprint 1's Auth/RBAC/audit infrastructure and Sprint
2-5's Course/Subject/Quiz/Assignment catalog data, rather than rebuilding any of it. This sprint also
resolves TD-020 (no enrollment/entitlement gate on Learning, deferred since Sprint 3).

## Decisions

**Enrollment is a single current-state row per (user, course), not a history-preserving join table.**
Unlike `MentorAssignment` (ADR-0016), which preserves every past assignment because "who was this
student's mentor, and when" matters, an `Enrollment` only needs to answer "does this user currently
have access to this course" — the full purchase history already lives in `Order` (one row per
transaction, append-only). `@@unique([userId, courseId])`: a lapsed/expired/revoked enrollment is
renewed by updating the same row (new `expiresAt`, `status` back to `ACTIVE`), not by inserting a
new one. `EnrollmentStatus` is `ACTIVE | EXPIRED | REVOKED`; `EnrollmentSource` is
`FREE | PURCHASE | ADMIN_GRANT` — free courses and admin-granted access both create an Enrollment
too, so every access-control check is a single, uniform "is there an active Enrollment" query
regardless of how access was obtained.

**Course pricing is scalar fields on the existing `Course` model, not a separate pricing/plan
table.** `priceAmount` (nullable `Decimal`) + `priceCurrency`: a course with `priceAmount = null` is
free (identical behavior to every course today — no regression for Sprint 2-3's existing free
catalog). A separate price-history/multi-tier-plan model is deferred (TD-036) — this sprint is
explicitly a commerce _foundation_, and price changes are rare enough that an admin editing one
field is adequate for now. This mirrors how `Quiz`/`Assignment` already carry their own scalar
configuration fields rather than an extension table.

**A new, dependency-direction-neutral `EnrollmentModule` sits at the same "base" tier as Learning/
Assessment/Assignments/Users** (no cross-feature imports of its own), specifically to avoid a
circular dependency. `CommerceModule` (coupons/orders/payments/invoices/refunds) needs to create an
`Enrollment` row when a payment succeeds; `LearningModule`/`AssessmentModule`/`AssignmentsModule`
each need to _check_ an enrollment before granting access to paid content. If enrollment access-
control lived inside `CommerceModule` itself, `Learning → Commerce` (for the check) and
`Commerce → Learning` (to validate a course exists/read its price) would cycle. Splitting Enrollment
into its own base-tier module breaks this: `EnrollmentModule ← {Learning, Assessment, Assignments,
Commerce}`, and `CommerceModule` reads `Course.priceAmount` via a plain `PrismaService` query rather
than importing `LearningModule` at all (it only needs a scalar read, not `CatalogService`'s curriculum-
tree/lesson-visibility logic) — so `CommerceModule` has no feature-module imports either. No cycle
exists anywhere in the resulting graph (confirmed via the pre-sprint repository health check, which
found zero circular dependencies in the existing Sprint 0-7 graph and this design preserves that).

**Access control gates Learning/Quiz/Assignment identically: resolve the content's course, then call
`EnrollmentService.assertCourseAccess(userId, courseId)`.** A `Quiz`/`Assignment` resolves its course
via the existing `subjectId → Subject.courseId` chain (both already optionally classify under a
Subject, reusing the Sprint 2 curriculum taxonomy per ADR-0014/0015) — no new relation is added.
Content with no subject/course link (a "general" quiz or assignment) has nothing to gate against and
remains unrestricted, matching today's behavior. The check is a no-op (always passes) for a free
course, so every existing Sprint 3-5 e2e test continues to pass unmodified — this sprint is additive,
not a breaking change to any prior sprint's access model.

**Mentor workflows are integrated via composition, not a new gate.** The kickoff asks to "integrate
enrollment with Mentor workflows," but mentor assignment (`MentorAssignment`, ADR-0016) is not
per-course — a mentor is assigned to a _student_, not a _course purchase_. Inventing a new business
rule ("mentor assignment requires an active enrollment") would be a product decision this sprint
has no clear mandate for, and risks contradicting a real intent (e.g. mentors doing free-tier
onboarding). Instead: Student 360 (ADR-0016) already composes `ProgressService`, `AdminQuizAttemptsService`,
and `SubmissionsService` — once those become entitlement-aware (per the bullet above), Student 360's
aggregated view is automatically entitlement-consistent with zero additional code. This satisfies the
literal integration requirement through the architecture that already exists, rather than adding a
speculative new rule (see Consequences).

**Payment gateway access is a port/adapter, exactly like `StoragePort`/`MalwareScannerPort`
(ADR-0015).** `PaymentGatewayPort` (`createOrder`, `verifyWebhookSignature`, `parseWebhookEvent`) is
`@Global()`; `RazorpayGatewayService` is the real adapter (`razorpay` SDK for order creation, Node's
`crypto` HMAC-SHA256 for webhook signature verification per SRS-02 Table 6's mandatory server-side
check); `FakePaymentGatewayService` is the test double, used by every automated test (mirroring
TD-027's already-accepted trade-off: the real adapter is manually verified, not CI-covered). The fake
computes the _same_ HMAC algorithm against a test secret, so tests exercise the real signature-
verification logic end-to-end, not a bypass — matching the EICAR-string philosophy from Sprint 5's
malware-scan tests (verify the real mechanism, fake only the external dependency).

**Webhook confirmation is the only path that grants an entitlement — a client-side payment callback
is never trusted (SRS-02 Table 6, mandatory).** `POST /commerce/payments/webhook` is the sole
endpoint that can transition an `Order` to `PAID` and create/renew an `Enrollment`; it requires a
valid gateway signature header and is idempotent by `gatewayPaymentId` (a duplicate or forged webhook
for an already-processed payment is a no-op, not a duplicate entitlement).

**Transaction logging reuses `AuditService`, not a new ledger table.** Every commerce/payment state
change (order created, webhook received, payment captured/failed, enrollment granted/revoked, refund
requested/approved/denied) calls `AuditService.record()` — identical to how every other sprint's
mutations are audited. A dedicated `PaymentTransaction` ledger would duplicate what `AuditLog` (with
its `before`/`after` JSON columns) already provides.

**Coupons apply to a single order at checkout time; no cart/multi-item order model.** A course
purchase is a single-item transaction (`Order.courseId`, not a line-items table) — this platform
currently sells individual course access, not bundles or subscriptions. `Coupon.discountType` is
`PERCENTAGE | FIXED`; validity (`validFrom`/`validUntil`, `maxRedemptions`) is checked at order-
creation time, and `redemptionCount` increments only once the order actually reaches `PAID` (an
abandoned/failed order does not consume a coupon redemption).

**Refunds are a foundation: a request/review state machine, not gateway-side settlement
automation.** `RefundStatus` is `REQUESTED → APPROVED | DENIED`, then `PROCESSED` once an admin marks
it done. Approving a refund revokes the associated `Enrollment` (`status = REVOKED`) and marks the
`Order` `REFUNDED`/`PARTIALLY_REFUNDED`; actually calling the gateway's refund API and reconciling
webhook-confirmed settlement is deferred (TD-037) — explicitly named as "foundation" in the kickoff.

## Consequences

- A course with no `priceAmount` is free — this is the same behavior every course has had since
  Sprint 3, so no existing catalog, progress, quiz, or assignment e2e test needed to change.
- Enrollment is per-course, not per-lesson/quiz/assignment granularity — simplest model that
  satisfies "gate paid content," consistent with how the course is the unit of sale.
- Mentor's "integration" is architectural (via Student 360 composition) rather than a new access
  rule; if the business later wants mentor assignment itself gated by a paid plan, that is a new,
  explicit decision for a future sprint, not silently introduced here.
- `EnrollmentModule` is a new "base" module alongside Learning/Assessment/Assignments/Users — this
  adds one more module to the dependency graph's base tier, but keeps that tier's defining property
  (no cross-feature imports) intact, so no cycle is introduced.
- Real Razorpay order-creation/webhook verification is only manually verified against a real
  Razorpay test account, never exercised by CI (mirrors TD-027's existing S3/ClamAV trade-off) —
  tracked as a new TD entry rather than treated as a gap unique to this sprint.

## Alternatives Considered

- **A single `Entitlement` model separate from `Enrollment`** (commerce-side "what did this grant"
  vs. learning-side "is this student enrolled"): rejected — with courses sold individually (no
  bundles/subscriptions yet), the two concepts collapse to the same row; a second model would be
  pure indirection with no current benefit.
- **Enrollment history preserved via append-and-supersede** (the `MentorAssignment` pattern):
  rejected — `Order` already provides the historical/audit trail; Enrollment only needs to answer
  the current-access question, and a single mutable row is simpler to query for that.
- **Gating Mentor assignment directly on active enrollment**: rejected — no existing requirement
  ties mentor eligibility to a specific paid course, and inventing that rule risks contradicting
  actual product intent; composition-based integration satisfies the kickoff without guessing.
- **A cart/line-items order model for future bundle support**: rejected for this sprint — no bundle/
  subscription requirement exists yet; a single-course-per-order model is simpler and can be
  extended to line items later without a breaking migration (an `Order` would gain items, not lose
  its `courseId`... actually a future migration would introduce `OrderItem` and deprecate the direct
  FK, which is an accepted, ordinary schema evolution, not a design flaw today).
