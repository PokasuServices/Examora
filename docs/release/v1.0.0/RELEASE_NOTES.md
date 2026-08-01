# Examora Platform v1.0.0 — Release Notes

**Release date**: 2026-08-01
**Status**: Feature development complete. Thirteen sprints delivered end-to-end, from
infrastructure setup through production-readiness hardening.

Examora is an exam-preparation and mentoring platform for design/fashion/architecture/aptitude
entrance exams, comprising three applications (`apps/api` — NestJS, `apps/web` — student-facing
Next.js, `apps/admin` — staff-facing Next.js) sharing a Postgres/Prisma data layer, Redis/BullMQ
background processing, and S3-compatible object storage.

---

## What's in v1.0.0

### Identity & Access

- Email/password registration and login, email verification, forgot/reset password, Google OAuth
- Rotating refresh tokens (hashed at rest, revoked on every use), session management (list/revoke
  individual/revoke-all-but-current)
- Full RBAC: roles, permissions, a fail-closed `JwtAuthGuard` (every route requires auth unless
  explicitly `@Public()`), `RolesGuard`/`PermissionsGuard` for fine-grained gating

### Learning

- **Course Management**: category → course → subject → topic → module → lesson content hierarchy,
  Draft/Published/Archived workflow
- **Learning Engine**: lesson progress tracking, per-course completion, Continue Learning, recently
  viewed
- **Assessment & Quiz Engine**: question bank, quiz authoring, timed attempts, automatic objective
  scoring, per-attempt review, question reporting
- **Creative Assignment Engine**: assignment authoring with configurable file rules, rubric-based
  review, student submission lifecycle (draft → files → submit), reviewer workflow, quarantine-by-
  default malware scanning on every upload

### Community & Mentoring

- **Mentor Management**: mentor profiles, student assignment (history-preserving), notes, tasks,
  meetings, feedback, Student 360 aggregated view
- **Community & Discussion**: forums, threads (including Doubt Resolution questions), replies,
  reactions, moderation, reputation, keyword search, attachments

### Commerce

- Enrollment (free and paid), Razorpay-backed orders/payments/webhooks, coupons, refund workflow,
  invoices

### Engagement

- Multi-channel notifications (in-app, email, SMS, WhatsApp, Web Push, mobile push) with per-user
  preferences, templates, admin broadcast composer, delivery tracking, scheduled (delayed) sends

### Intelligence & Content

- **Analytics & Reporting**: student/mentor/admin dashboards, a report builder across ten report
  types, CSV/PDF export, scheduled recurring reports
- **AI Recommendation Engine**: rule-based (no external AI services) course/quiz/assignment/
  learning-path recommendations, Continue Learning, Similar Courses, related community discussions,
  per-type admin feature flags, every result carries an explainable `{score, reason}`
- **CMS & Publishing Workflow**: Draft → Review → Approval → Publish → Archive for landing/static
  pages, FAQ, announcements, and banners, with version history/compare/restore, scheduled publish/
  unpublish, and a malware-scanned media library

### Production Readiness (Sprint 13)

- Rate limiting on every endpoint, tightened further on authentication routes
- CORS fails closed (refuses to boot) in production if left unconfigured, rather than silently
  allowing any origin
- Background job reliability: every scheduled/one-time job now retries with backoff on transient
  failure
- Six database indexes added where query patterns weren't well served by existing ones
- All three Docker images (`apps/api`, `apps/web`, `apps/admin`) build and run correctly — verified
  end-to-end for the first time in this project's history
- Full architecture/security/performance code review with every genuine finding fixed or tracked

---

## By the numbers

- **13 sprints**, Sprint 0 (infrastructure) through Sprint 13 (production readiness)
- **676 automated tests** (420 unit/integration + 256 e2e), all green
- **23 backend feature modules**, verified free of circular dependencies
- **23 Architecture Decision Records** documenting every significant design choice
- **49 tracked technical debt items** (see `docs/release/v1.0.0/TECHNICAL_DEBT_SUMMARY.md`) — every
  known gap is written down with a rationale and a plan, none silently swept aside

## Upgrade / deployment notes

This is the first release — there is no prior version to migrate from. See
`docs/release/v1.0.0/DEPLOYMENT_CHECKLIST.md` before deploying to any real environment; in
particular, note that the Docker images build and run correctly but are not yet fully deploy-ready
(`NEXT_PUBLIC_*` values are baked in blank — see TD-049) and CI does not yet build/push images or
deploy anywhere (TD-007).

## Known limitations

See `docs/release/v1.0.0/KNOWN_LIMITATIONS.md` for the full, honest list — highlights: no load/
stress testing has been performed against SLA targets, no WCAG accessibility audit has been done, no
third-party penetration test has been performed (Sprint 13's security work was an in-repo code
review), and observability (metrics/tracing/error-tracking beyond structured stdout logs) is not yet
wired up.
