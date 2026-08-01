# ADR-0023: Production Readiness Hardening (Sprint 13)

Status: Accepted
Date: 2026-08-01
Deciders: Engineering

## Context

Sprint 13 is the Release Readiness Sprint — no new business features, only architecture/
performance/security review and safe fixes ahead of Examora v1.0.0. The review surfaced several
genuine, concrete gaps rather than hypothetical ones: no rate limiting existed anywhere in the API
(including login/register), CORS silently fell back to reflecting any origin with credentials
enabled when `CORS_ORIGINS` was unset, and the three Dockerfiles — never actually build-tested,
since CI only lints/typechecks/builds/tests (TD-007) — turned out to be genuinely broken by two
separate bugs. Several background jobs that fire a one-time "do the scheduled thing" action had no
retry policy, unlike their sibling immediate-work queues (malware scan, notification delivery),
which already retry with backoff.

## Decisions

### 1. Rate limiting via `@nestjs/throttler`, skipped only under `NODE_ENV=test`

A single global default (100 requests/60s per IP) applies to every route via `APP_GUARD`, running
before `JwtAuthGuard` so it caps both public and authenticated traffic. `/auth/register`,
`/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, and `/auth/resend-verification` are
individually tightened to 5/60s via `@Throttle()` — the classic credential-stuffing/account-
enumeration/email-spam targets.

The automated e2e suite runs hundreds of requests per spec file from the same loopback address with
no artificial delay; enforcing the real limit there would trip almost immediately and prove nothing
about genuine abuse. `shouldSkipThrottling()` (`apps/api/src/common/rate-limit.config.ts`) disables
enforcement when `NODE_ENV=test`, mirroring how `GoogleConfiguredGuard` and every notification
channel adapter already special-case their environment rather than behaving identically everywhere.
The real behavior is not left unverified, though: `test/rate-limiting.e2e-spec.ts` is the one place
that deliberately flips `process.env.NODE_ENV` to `"production"` around a request burst, proving the
429/backoff/header behavior end-to-end rather than only manually.

### 2. CORS fails closed in production, not open

`corsOrigins.length > 0 ? corsOrigins : true` previously meant an unset `CORS_ORIGINS` in any
environment — including a real production deploy someone forgot to configure — silently became
`origin: true` (reflect any origin) with `credentials: true`. `configureApp()` now throws at boot if
`nodeEnv === "production"` and `corsOrigins` is empty, matching `env.validation.ts`'s own "fail fast
on boot rather than fail confusingly later" philosophy. Non-production environments keep the
permissive fallback, since local dev has no fixed frontend port list to require.

This was not, in practice, an exploitable hole today: the refresh token cookie is
`sameSite: "strict"`, which a permissive CORS response header cannot override — a `strict` cookie is
simply never attached to a cross-site request by the browser, regardless of what
`Access-Control-Allow-Origin` says. The fix closes a _misconfiguration_ risk (an easy-to-miss silent
wide-open default) rather than an active vulnerability.

### 3. Background "fire the scheduled thing" jobs now retry with backoff, matching their siblings

`CmsSchedulingQueueService.schedule()`, `ScheduledReportsService`'s `runNow()`/`upsertJobScheduler()`
job template, and `NotificationQueueService.scheduleNotification()` previously had no retry
configuration (`upsertJobScheduler`/plain `.add()` default to `attempts: 1`) or an explicit
`attempts: 1`. A transient failure meant a scheduled CMS publish, a scheduled report, or a scheduled
notification simply never fired — no second chance. All three now use `attempts: 3` with exponential
backoff (`5000ms` base), the same policy already proven on the malware-scan and notification-delivery
queues since Sprint 5/9. A retry replaying an already-successful transition is a pre-existing,
accepted characteristic of at-least-once job queues (see the malware-scan/delivery queues, which
already have this property) — not a new risk this introduces.

### 4. Docker images actually build now — two real, previously-undiscovered bugs fixed

No CI job has ever run `docker build` (TD-007), so none of the three Dockerfiles had ever been
build-tested end-to-end. Sprint 13 found and fixed two bugs, then verified all three images build
and run correctly via real `docker build`/`docker run` against docker-compose Postgres/Redis/MinIO:

- **TD-010** (`output: "standalone"` disabled): re-enabled, but gated behind a `DOCKER_BUILD=1`
  env var set only inside the Dockerfiles, rather than unconditionally — the underlying Windows
  symlink/EPERM restriction is a host-machine limitation with no Linux equivalent, so leaving
  `pnpm build` unconditionally standalone would break every Windows contributor without Developer
  Mode enabled, for zero benefit (Docker/CI builds are always Linux either way).
- **New**: `turbo prune --docker`'s pruned output does not carry root-level files that live outside
  any workspace package — `tsconfig.base.json`, which every package's `tsconfig.json` extends, was
  silently missing from every Dockerfile's `builder` stage, breaking every `tsup`/`next`/`nest`
  build in the dependency graph with `TS5083: Cannot read file`. Fixed with an explicit
  `COPY --from=pruner /repo/tsconfig.base.json .` in each Dockerfile.

`apps/web`/`apps/admin`'s Dockerfiles also needed a placeholder `RUN touch .env` before their build
step (`.dockerignore` correctly excludes the real `.env`, but `next build`'s `dotenv -e ../../.env`
wrapper still needs the path to exist) — mirroring `ci.yml`'s identical existing step, for the same
reason.

This does not make the images deploy-ready end-to-end: `NEXT_PUBLIC_*` values are baked in blank
(tracked as TD-049) since no build-arg plumbing exists yet, and TD-007 (no CI image build/push job)
remains open.

### 5. Six schema indexes added where query shape and existing indexes didn't line up

`AssignmentReview.reviewerId` (the model had zero indexes at all), `AssignmentSubmission.studentId`
(standalone — the existing composite index leads with `assignmentId`, which doesn't serve a
studentId-only lookup like `listHistory(studentId)` without an assignment filter), `Order.courseId`,
`Reply.authorId`, `NotificationDelivery(channel, status)`, and `Notification.createdAt` (the admin
`listAll` endpoint sorts by this with no `userId` filter in the common case). Migration
`20260801154404_sprint13_performance_indexes`. Chosen from a broader N+1/index audit as the
highest-confidence, lowest-risk items — pure additive schema changes with no application-code
behavior change, unlike the deeper query-batching opportunities documented instead as TD-046.

### 6. Two genuinely-unused cross-module exports removed

`AuthModule` no longer exports `AuthService` (no other module imports `AuthModule`);
`NotificationModule` no longer exports `NotificationPreferencesService`/`WebPushSubscriptionsService`
(both only ever injected into their own controllers, already declared in the same module). Verified
via a full cross-module dependency graph trace before removing either — zero behavior change, since
nothing outside each module's own boundary consumed them.

## Consequences

- Every endpoint is now rate-limited; a legitimate high-volume admin workflow that issues >100
  requests/minute from one IP would need a per-route `@Throttle()` override, the same mechanism used
  to tighten the auth endpoints.
- A production deploy with no `CORS_ORIGINS` set now fails to boot instead of silently running with
  an open CORS policy — an operator must set it explicitly.
- Docker images can be built and smoke-tested locally for the first time; they are not yet wired
  into CI (TD-007) or fully deploy-ready (TD-049).
- `docs/TECHNICAL_DEBT_REGISTER.md` gained TD-046 (analytics query fan-out, deliberately not
  refactored this sprint — too central and too risky to batch blind under an audit sprint's time
  budget), TD-047 (OAuth access token transits a URL query string, deferred pending a testable
  redesign), TD-048 (no system-wide dangerous-mimetype floor beneath admin-configured assignment
  file rules), and TD-049 (Docker images bake blank `NEXT_PUBLIC_*` values).

## Alternatives Considered

- **Redis-backed distributed rate limiting** instead of `@nestjs/throttler`'s default in-memory
  storage: rejected for this pass — the API currently runs as a single instance per environment (no
  horizontal scaling configured yet), so a per-instance in-memory limiter is sufficient; revisit if
  the API is ever deployed with multiple replicas behind a load balancer, since in-memory limits
  don't share state across instances.
- **Refactor `ProgressService.getCourseProgress` to batch across courses/students now** (closing
  TD-046 immediately rather than documenting it): rejected — it's a heavily-relied-upon method
  (recommendations, three analytics dashboards, mentoring) and a behavior-preserving batch rewrite
  under review-sprint time pressure, with no dedicated regression-test cycle, is a worse risk/reward
  trade than documenting it precisely and fixing it with proper attention later.
- **Implement the OAuth handoff-code redesign now** (closing TD-047 immediately): rejected — no live
  Google OAuth credentials are available in this environment to validate the full round trip, and
  the existing flow is not actively exploited (short-lived token, `sameSite: strict` refresh cookie
  unaffected) — safer to document precisely than to ship an unverified change to a security-sensitive
  flow.
