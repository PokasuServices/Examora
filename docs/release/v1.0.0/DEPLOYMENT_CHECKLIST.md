# Deployment Checklist — v1.0.0

Actionable steps for taking this release from "builds and tests pass" to "serving real traffic."
Ordered so each section's prerequisites are satisfied by the ones above it. Cross-references
`docs/release/v1.0.0/KNOWN_LIMITATIONS.md` throughout — read that document first.

## 1. Before you start

- [ ] Read `KNOWN_LIMITATIONS.md` in full — in particular, TD-049 (blank `NEXT_PUBLIC_*` in Docker
      builds) blocks a working web/admin deployment until closed.
- [ ] Decide on a target environment (cloud provider, container orchestration) — none is assumed or
      pre-configured anywhere in this repo.

## 2. Secrets and configuration

- [ ] Generate real values for every secret currently marked `replace_with_...` in `.env.example`:
      `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (both ≥32 chars, enforced at boot by
      `env.validation.ts` — the app refuses to start otherwise).
- [ ] Set `CORS_ORIGINS` to your real frontend origin(s), comma-separated. **This is now mandatory in
      production** (Sprint 13, ADR-0023 §2) — the API refuses to boot with `NODE_ENV=production` and
      an empty `CORS_ORIGINS`, rather than silently falling back to an open CORS policy.
- [ ] Configure real credentials for every vendor integration you intend to use: AWS SES (email),
      Twilio (SMS/WhatsApp), VAPID keys (Web Push), Cloudflare Stream (video), Razorpay (payments),
      Google OAuth. Every one of these is optional — the app boots and logs-instead-of-sends when
      unconfigured — but decide deliberately which you need live for launch.
- [ ] Point `DATABASE_URL`, `REDIS_URL`, `S3_*`, `CLAMAV_HOST`/`CLAMAV_PORT` at your real
      infrastructure, not the docker-compose local defaults.
- [ ] Never commit the real `.env` — confirmed already excluded via `.gitignore` and `.dockerignore`.

## 3. Database

- [ ] Provision a production Postgres instance (v16, matching `docker-compose.yml`'s image).
- [ ] Run `prisma migrate deploy` (not `migrate dev`) against it — the CI workflow's own migration
      step (`pnpm --filter @examora/database migrate:deploy`) is the reference command.
- [ ] Run the seed script (`pnpm db:seed`) if you need baseline roles/permissions/an initial
      administrator account — review `database/prisma/seed.ts` first, since self-registration always
      assigns the STUDENT role only (by design, ADR-0006) and every other role must be provisioned
      manually.
- [ ] Confirm the six new Sprint 13 indexes applied (migration
      `20260801154404_sprint13_performance_indexes`).

## 4. Redis

- [ ] Provision a production Redis instance (v7, matching `docker-compose.yml`'s image). BullMQ
      requires `maxRetriesPerRequest: null` on its connection — already handled by
      `RedisModule`/`BULLMQ_REDIS_CLIENT`, but confirm your Redis provider doesn't impose connection
      limits that would starve the six BullMQ queues (malware scan ×3, notification delivery/
      schedule, CMS scheduling, scheduled reports).
- [ ] Note: `@nestjs/throttler`'s rate-limit storage is in-memory per API instance by default
      (ADR-0023 §1's "Alternatives Considered"). If you deploy more than one API replica behind a
      load balancer, rate limits will not be shared across instances — evaluate a Redis-backed
      throttler storage adapter before horizontally scaling.

## 5. Object storage & malware scanning

- [ ] Provision real S3 (or S3-compatible) storage — MinIO is docker-compose-local only.
- [ ] Provision a real ClamAV instance reachable at `CLAMAV_HOST`/`CLAMAV_PORT` — every file upload
      (assignments, community attachments, CMS media) is quarantined until scanned CLEAN; without a
      reachable scanner, uploads will sit `PENDING` forever.

## 6. Docker images

- [ ] Build all three images: `docker build -f apps/api/Dockerfile -t examora-api .`,
      `apps/web/Dockerfile`, `apps/admin/Dockerfile` (build context must be the monorepo root — see
      the comment at the top of each Dockerfile). Verified working end-to-end in Sprint 13.
- [ ] **Before deploying web/admin**: close TD-049 — wire real `NEXT_PUBLIC_API_URL`,
      `NEXT_PUBLIC_ADMIN_API_URL`, `NEXT_PUBLIC_API_ORIGIN`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in as
      Docker build args, since Next.js inlines these into the client bundle at build time, not
      runtime. Building with today's Dockerfiles as-is produces a working-but-misconfigured image.
- [ ] Add a vulnerability scan (Trivy, Snyk, or your registry's built-in scanner) to whatever
      pipeline builds these images — not present today.
- [ ] Wire an image build/push step into CI (TD-007) so this stops being a manual, easy-to-forget
      step — nothing does this today.

## 7. Health checks & process management

- [ ] Point your orchestrator's liveness probe at `GET /health/live` (no dependencies, always 200 if
      the process is up) and readiness probe at `GET /health/ready` (checks Postgres + Redis).
      `GET /health` additionally checks heap memory — suitable for a manual/dashboard check, not
      necessarily a tight liveness loop.
- [ ] Confirm graceful shutdown works in your environment — `main.ts` calls
      `app.enableShutdownHooks()`; verify your orchestrator sends `SIGTERM` (not `SIGKILL`) with a
      reasonable grace period so in-flight requests and BullMQ jobs can finish.

## 8. Observability (currently absent — TD-003)

- [ ] Decide on and wire up an APM/error-tracking tool (`SENTRY_DSN` env var already exists,
      unconsumed) before relying on this in production — today's only signal is structured JSON logs
      to stdout.
- [ ] Decide on a log aggregation destination (the app already emits structured JSON via
      `nestjs-pino`, correlation-ID-tagged, with `Authorization`/`Cookie` headers redacted — just
      needs a shipper/sink).
- [ ] Set up alerting on `/health/ready` failures at minimum, until a real metrics/tracing stack
      exists.

## 9. Load and security validation (not performed by Sprint 13 — see Known Limitations)

- [ ] Run an actual load/stress/spike test against a staging deployment before assuming the
      documented SLA targets (API p95 <500ms, LCP <2.5s, availability >99.9%) hold — Sprint 13 did a
      static query audit, not live load testing.
- [ ] Commission or run a real penetration test — Sprint 13's security work was an in-repo code
      review, not an external attack simulation.
- [ ] Run a WCAG 2.1 AA accessibility pass across `apps/web`/`apps/admin` if that's a compliance
      requirement for your launch — not done in any sprint to date.

## 10. Final sign-off

- [ ] Full automated suite green in your CI environment: `pnpm lint && pnpm typecheck && pnpm build
    && pnpm test && pnpm --filter @examora/api test:e2e` (676 tests as of v1.0.0).
- [ ] Every item above either checked off or consciously accepted as a known gap — cross-reference
      `docs/release/v1.0.0/KNOWN_LIMITATIONS.md` one more time before declaring launch-ready.
