# Examora Platform

AI-powered exam preparation and mentoring platform for design/fashion/architecture/aptitude
entrance exams. Governed by [`documents/00_Master_Development_Guide_Examora_Platform_MDG-00.docx`](documents/00_Master_Development_Guide_Examora_Platform_MDG-00.docx).

## Status

**Sprint 8 — Commerce, Enrollment & Payments (complete).** Courses can carry a price
(`priceAmount`/`priceCurrency`; `null` means free, preserving all prior free-course behavior).
Students check out a paid course through a gateway-agnostic payment abstraction (Razorpay is the
concrete adapter, mirroring the `StoragePort`/`MalwareScannerPort` split from ADR-0015) — entitlement
is granted only by a server-verified webhook, never a client callback (SRS-02 Table 6). A new
base-tier `EnrollmentModule` tracks course entitlements (active/expired/revoked) and gates
Learning/Assessment/Assignments on it, deliberately split out of Commerce to avoid a circular
dependency (Commerce grants entitlements, Learning/Assessment/Assignments check them). Coupons
(percentage/fixed, redemption-capped, date-bounded) apply at checkout; refunds are a
request → review → process state machine (foundation only — no real gateway-side settlement yet,
TD-037) that revokes the enrollment and marks the order refunded when processed. Admins get
coupon/order/refund/enrollment management UI; students get pricing display, a checkout flow, and
purchase/payment/invoice history. See [ADR-0018](docs/adr/0018-commerce-enrollment-payments.md) for
the full design. Builds on Sprint 7 (Community & Discussion Module: forums, doubt resolution,
reputation, moderation), Sprint 6 (Mentor Management: mentor profiles, history-preserving mentor↔
student assignment, Student 360, mentor workflow), Sprint 5 (Creative Assignment Engine: assignment
authoring/templates, presigned upload + quarantine-by-default malware scanning, rubric review),
Sprint 4 (Assessment & Quiz Engine: question bank, quiz authoring, timed autosaving attempts,
automatic scoring, attempt monitoring), Sprint 3 (Learning Engine: published-only catalog, lesson
viewer/completion, progress dashboard), Sprint 2 (Course Management: the
`Category → Course → Subject → Topic → Module → Lesson` content hierarchy, DRAFT/PUBLISHED/ARCHIVED
workflow, CRUD/reorder APIs, admin content UI), and Sprint 1 (Authentication & Identity:
registration, email verification, login/logout, refresh rotation, password reset, sessions, RBAC +
permissions, profiles, Google OAuth, consent, audit). A dedicated non-admin MODERATOR role, full-text
search, real gateway-side refund settlement, and multi-tier/promotional pricing are explicitly
deferred (see TD-030/TD-031/TD-036/TD-037). Notifications, analytics, AI, and further CMS
enhancements are not started. See
[`docs/roadmap/SPRINT_BACKLOG.md`](docs/roadmap/SPRINT_BACKLOG.md) for the full plan.

> Malware scanning and object storage run against real ClamAV/S3-compatible (MinIO) adapters in
> dev/prod, but every automated test uses fake in-memory adapters instead (ADR-0015) — the real
> adapters are only manually verified, not CI-covered (TD-027). Razorpay follows the same pattern
> (TD-038): `RazorpayGatewayService` is the real adapter, `FakePaymentGatewayService` backs every
> automated test.

> Email is not actually delivered yet — Sprint 1 uses a console-logging mailer stub (ADR-0009);
> verification/reset tokens appear in the `apps/api` logs. Real delivery arrives with the
> Notification Service in Sprint 10.

### First administrator

Self-registration only ever grants the STUDENT role. To create the first administrator, promote a
registered user directly in the database:

```sql
UPDATE user_roles SET role_id = (SELECT id FROM roles WHERE name = 'ADMINISTRATOR')
WHERE user_id = (SELECT id FROM users WHERE email = 'you@example.com');
```

Then re-login to pick up the new role, and visit the admin app at http://localhost:3002.

## Repository Structure

```
apps/
  web/        Student & public-facing Next.js app
  api/        NestJS backend API
  admin/      Admin portal Next.js app
packages/
  ui/          Shared React component library
  shared/      Shared business constants/logic
  types/       Shared TypeScript types/DTOs
  utils/       Shared utilities
  auth-client/ Shared React auth context + API client (AuthProvider/useAuth) for web + admin
database/     Prisma schema, migrations, seed (workspace package @examora/database)
docs/         ADRs, roadmap, checklists, decisions log — see below
infra/        Infrastructure as code (added from Sprint 2+)
scripts/      Build/maintenance scripts
documents/    Governing specification documents (source of truth for requirements)
screens/      Competitor reference screenshots — functional reference ONLY, see ADR-0008
```

## Documentation

- [`docs/adr/`](docs/adr/) — Architecture Decision Records
- [`docs/roadmap/IMPLEMENTATION_ROADMAP.md`](docs/roadmap/IMPLEMENTATION_ROADMAP.md) — phase-level plan
- [`docs/roadmap/SPRINT_BACKLOG.md`](docs/roadmap/SPRINT_BACKLOG.md) — sprint-by-sprint backlog
- [`docs/DEVELOPMENT_CHECKLIST.md`](docs/DEVELOPMENT_CHECKLIST.md) — DoR/DoD and per-feature checklists
- [`docs/TECHNICAL_DEBT_REGISTER.md`](docs/TECHNICAL_DEBT_REGISTER.md) — tracked shortcuts and gaps
- [`docs/DECISIONS_AND_ASSUMPTIONS.md`](docs/DECISIONS_AND_ASSUMPTIONS.md) — decisions/assumptions log

## Prerequisites

- Node.js >= 20 (see `.nvmrc`)
- pnpm >= 9 (`corepack enable` will pick up the pinned version from `package.json#packageManager`)
- Docker + Docker Compose (for local Postgres/Redis/MinIO)

## Getting Started

```bash
pnpm install
cp .env.example .env          # fill in local values
docker compose up -d          # starts Postgres, Redis, MinIO (add `clamav` too for real malware scanning — optional, see TD-027)
pnpm db:migrate                # applies Prisma migrations
pnpm dev                       # runs api (3001), web (3000), admin (3002) in parallel
```

- API: http://localhost:3001/api/v1, Swagger at http://localhost:3001/api/docs, health at
  http://localhost:3001/health
- Web: http://localhost:3000
- Admin: http://localhost:3002
- MinIO console: http://localhost:9001

## Common Commands

```bash
pnpm build          # build all workspaces
pnpm lint            # lint all workspaces
pnpm typecheck       # typecheck all workspaces
pnpm test            # unit/integration tests
pnpm format          # format with Prettier
pnpm changeset       # record a changeset for a change
pnpm db:studio       # open Prisma Studio
```

## Engineering Standards

All contributors (human or AI) must follow `documents/00_Master_Development_Guide_Examora_Platform_MDG-00.docx`
and the checklists in `docs/DEVELOPMENT_CHECKLIST.md`. Every feature requires backend, frontend,
database migration, tests, Swagger documentation, RBAC enforcement, and audit logging — see
MDG-00 §21 (Feature Workflow) and §19 (Definition of Done).
