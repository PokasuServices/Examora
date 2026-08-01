# Production Readiness Report — v1.0.0

**Scope**: Sprint 13, the Release Readiness Sprint — a full architecture/performance/security code
review of the entire platform, with safe fixes applied and every gap tracked. No new business
features. This report synthesizes the findings; see `ARCHITECTURE_HEALTH_REPORT.md`,
`TECHNICAL_DEBT_SUMMARY.md`, and `KNOWN_LIMITATIONS.md` for deeper detail on each area.

## Overall verdict

**The application code is production-ready. The deployment infrastructure around it is not yet.**
Thirteen sprints of feature work are complete, tested (676 automated tests, all green), and pass a
full architecture/security/performance review with every genuine issue fixed or explicitly tracked.
What's missing is entirely _operational_: no CI/CD pipeline builds or deploys anything (TD-007), no
observability stack exists beyond structured logs (TD-003), and the Docker images — while now
verified to build and run correctly for the first time — need one more piece of build-arg plumbing
(TD-049) before they're truly deploy-ready. None of this is a code-quality problem; all of it is
"infrastructure that doesn't exist yet because no target environment has existed yet."

## Architecture: healthy

Full circular-dependency and DI audit across all 23 backend modules — clean, no cycles, no
anti-patterns. Prisma schema (69 models) reviewed for consistency; compliance-sensitive cascade
behavior (audit logs surviving user deletion) verified correct. Two unused cross-module exports
removed. Full detail: `ARCHITECTURE_HEALTH_REPORT.md`.

## Security: hardened this sprint

| Area             | Finding                                                                                                                                                                                              | Resolution                                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rate limiting    | **None existed anywhere** — login/register fully open to brute-force                                                                                                                                 | Added globally (`@nestjs/throttler`, 100/min default), tightened to 5/min on auth endpoints. Proven end-to-end by a dedicated e2e test (real 429s, real headers), not just configured    |
| CORS             | Silently fell back to reflecting any origin with credentials when `CORS_ORIGINS` was unset                                                                                                           | Now fails closed — refuses to boot in production without it configured                                                                                                                   |
| Authentication   | argon2id password hashing, rotating refresh tokens (hashed at rest, revoked on use), account-enumeration-safe error messages throughout, `httpOnly`+`secure`(prod)+`sameSite: strict` refresh cookie | Already solid — reviewed, no changes needed                                                                                                                                              |
| Authorization    | Fail-closed `JwtAuthGuard` (deny by default, explicit `@Public()` opt-out), `PermissionsGuard`/`RolesGuard` with audit-logged denials                                                                | Already solid — reviewed, no changes needed                                                                                                                                              |
| Input validation | Global `ValidationPipe` (whitelist + forbidNonWhitelisted + transform) on every endpoint                                                                                                             | Already solid — reviewed, no changes needed                                                                                                                                              |
| File uploads     | Consistent mime-type allowlist + size-limit validation across all three upload flows (assignments, community, CMS), backed by mandatory quarantine-by-default malware scanning                       | Already solid; one minor gap noted (TD-048, no system-wide dangerous-mimetype floor beneath admin-configured rules) — low severity, not fixed                                            |
| SQL injection    | Prisma parameterized queries throughout; the only raw SQL in application code is a static, parameterless `SELECT 1` health check                                                                     | No issue found                                                                                                                                                                           |
| XSS              | Zero `dangerouslySetInnerHTML` anywhere in either frontend app; `helmet()`'s default CSP applied                                                                                                     | No issue found                                                                                                                                                                           |
| CSRF             | `sameSite: strict` cookie + Authorization-header-based auth for all state-changing requests makes classic CSRF structurally hard regardless of CORS config                                           | No issue found                                                                                                                                                                           |
| Secrets          | No hardcoded secrets found (grepped for common patterns — only test fixtures matched); `.env`/`.gitignore`/`.dockerignore` all correctly exclude real secrets from version control and image layers  | No issue found                                                                                                                                                                           |
| Background jobs  | Three scheduled-job queues (CMS publish, scheduled reports, scheduled notifications) had no retry policy — a transient failure meant the scheduled action simply never happened                      | Fixed — all three now retry 3× with exponential backoff, matching the existing malware-scan/delivery queues                                                                              |
| OAuth            | Access token transits a URL query string on the Google OAuth callback                                                                                                                                | Documented (TD-047), not fixed — no live Google credentials available to validate a redesign end-to-end; low severity given the token's short TTL and the unaffected refresh-cookie flow |

**Not performed**: a third-party penetration test. This was an in-repo code review, not an external
attack simulation — see `KNOWN_LIMITATIONS.md`.

## Performance: six indexes added, deeper patterns documented

A full N+1-query and missing-index audit was performed across every service in `apps/api/src`.
Six schema indexes were added where query shape and existing indexes genuinely didn't line up
(`AssignmentReview.reviewerId` had zero indexes on the whole model; `Order.courseId`;
`Reply.authorId`; a standalone `AssignmentSubmission.studentId`; `NotificationDelivery(channel,
status)`; `Notification.createdAt`) — pure additive schema changes, zero application-code risk,
migration `20260801154404_sprint13_performance_indexes`.

The deepest finding — admin/mentor analytics dashboards fanning out O(students × courses) queries by
reusing a per-item progress-computation method — was deliberately **not** refactored this sprint
(TD-046). It's cheap at current data volumes and touches heavily-relied-upon, previously-tested code
across recommendations, three analytics dashboards, and mentoring; a behavior-preserving batch
rewrite needs its own dedicated review cycle, not a same-day change under an audit sprint's budget.

**Not performed**: live load/stress/spike/soak testing against SLA targets (API p95, LCP,
availability) — no load-testing tool is available in this environment. A static query audit is a
different, narrower kind of performance validation than actual load testing; see
`KNOWN_LIMITATIONS.md`.

## Testing: 676 automated tests, all green

- 420 unit/integration tests (including 7 new this sprint, proving the rate-limit config and the
  CORS fail-closed behavior)
- 256 e2e tests (including 2 new this sprint, proving the real 429 throttling behavior against a live
  request burst — deliberately the one spec that runs with throttling actually enabled, since every
  other e2e spec intentionally disables it to avoid tripping on hundreds of rapid loopback requests)
- Full suite re-run after every fix in this sprint, not just once at the end

**Not performed**: manual UAT sign-off by a human Product Owner — QA-15's regression-pass
requirement was satisfied via the automated suite instead.

## Documentation: synchronized

README, all 23 ADRs (including the new ADR-0023 covering every Sprint 13 decision), the Sprint
Backlog (Sprint 13 entry rewritten to reflect what was actually delivered vs. the original planned
bullets, with each gap named explicitly rather than silently dropped), the Technical Debt Register
(45 active entries, 6 resolved this sprint's predecessors plus TD-010 resolved this sprint, 4 new
entries added), and the Decisions & Assumptions log are all current as of this report. Swagger
(`/api/docs`) annotation coverage spot-checked — consistent `@ApiTags`/`@ApiOperation` usage across
every controller reviewed.

## DevOps: Docker fixed and verified; CI/CD and observability remain gaps

Found and fixed two real, previously-undiscovered bugs that meant **no Docker image had ever
successfully built** before this sprint (TD-010) — verified via real `docker build` and `docker run`
for all three images against live docker-compose Postgres/Redis/MinIO, including a full `/health`
check returning healthy from a running `apps/api` container. Health check endpoints
(`/health`, `/health/live`, `/health/ready`), structured logging with correlation IDs and
sensitive-header redaction, and non-root Docker users with multi-stage builds were all already in
good shape and confirmed working.

**Remaining gaps** (all pre-existing, all tracked): no CI job builds or pushes an image (TD-007), no
observability stack beyond stdout logs (TD-003), and the web/admin Docker images need build-arg
plumbing for `NEXT_PUBLIC_*` config before they're genuinely deploy-ready (TD-049, the release's one
open P1). See `DEPLOYMENT_CHECKLIST.md` for the full path from here to a real deployment.

## Recommendation

**Ship the v1.0.0 codebase.** It is well-architected, thoroughly tested, and has had a genuine
security/performance hardening pass with real, verified fixes — not a rubber-stamp review. Do not
deploy to production traffic until the operational gaps in `DEPLOYMENT_CHECKLIST.md` are closed,
particularly TD-049 (Docker build-arg plumbing) and at least a baseline observability setup (TD-003)
so a production incident is diagnosable.
