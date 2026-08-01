# Known Limitations — v1.0.0

An honest accounting of what this release does _not_ do, so nobody discovers these the hard way in
production. Each item names why it wasn't addressed and what would need to happen to close it.

## Not performed in Sprint 13 (explicitly out of scope, not overlooked)

- **Load/stress/spike/soak testing against SLA targets** (API p95 <500ms, LCP <2.5s, availability
  > 99.9%). No load-testing tool (k6, artillery, or similar) is available in this environment. What
  > _was_ done instead: a static N+1-query and missing-index audit (see the Production Readiness
  > Report's Performance section) — a different, narrower kind of performance work that finds
  > structural query problems but cannot tell you actual latency under concurrent load. Before any
  > real production traffic, run an actual load test against a staging environment.
- **WCAG 2.1 AA accessibility audit**. Not named in the Sprint 13 kickoff's explicit review
  checklist; no semantic-HTML/ARIA/color-contrast/keyboard-navigation pass has been done across
  `apps/web` or `apps/admin`.
- **Third-party penetration test**. Sprint 13's security work was an in-repo code review (auth flow
  reading, guard logic tracing, dependency/config auditing) — real value, but not a substitute for
  an external party actually attempting to break in.
- **Manual UAT sign-off**. The "QA-15 regression pass" requirement was satisfied via the full
  automated suite (676 tests), not a human Product Owner's manual walkthrough and sign-off.

## Infrastructure not yet in place

- **No CI/CD image build or deployment pipeline** (TD-007). `.github/workflows/ci.yml` lints,
  typechecks, builds, and tests — it does not build or push a Docker image, and there is no staging
  or production deploy job anywhere. Every Docker image build performed for Sprint 13's verification
  was run manually, locally.
- **No observability stack** (TD-003): metrics, distributed tracing, and error tracking
  (Prometheus/Grafana/Loki/OpenTelemetry/Sentry) are all unwired — `SENTRY_DSN` and
  `OTEL_EXPORTER_OTLP_ENDPOINT` exist as documented-but-empty env vars. The only signal available in
  production today is structured JSON logs to stdout (via `nestjs-pino`, with correlation IDs and
  sensitive-header redaction already wired in). Without a real APM/error-tracking tool, diagnosing a
  production incident means reading raw log streams.
- **No production runbooks, backup/restore validation, or live monitoring/alerting** — OPS-24's
  original scope. These require an actual target deployment environment to write against and
  weren't attempted against a hypothetical one.

## Docker images build and run, but are not fully deploy-ready

Sprint 13 discovered and fixed two real bugs that meant **no Docker image had ever successfully
built before this sprint** (see TD-010 and ADR-0023 for the full story) — all three now build and
run correctly, verified via real `docker build`/`docker run` against docker-compose Postgres/Redis/
MinIO. That verification also surfaced what's still missing before these specific images could serve
real traffic:

- `apps/web`/`apps/admin`'s Docker builds bake `NEXT_PUBLIC_*` config in blank (TD-049, the release's
  one open P1) — no build-arg plumbing exists yet to pass real values at image-build time.
- No image includes a supply-chain/vulnerability scan (Trivy, Snyk, or similar) — not run, not
  wired into any pipeline.

## Security items found and documented, not fixed

Every genuine issue found in Sprint 13's security review was either fixed or is listed here with a
reason it wasn't:

- **OAuth access token transits a URL query string** (TD-047): the Google OAuth callback redirects
  with `?accessToken=<jwt>` in the URL. Low severity in practice (short-lived token, and the
  separate refresh cookie is `sameSite: strict` regardless), but a known anti-pattern. Not fixed
  because the safer redesign (a single-use opaque handoff code) is a real behavior change to a flow
  with no live Google OAuth credentials available in this environment to validate end-to-end —
  higher risk to ship blind than to document precisely and defer.
- **No system-wide dangerous-mimetype floor** beneath admin-configured assignment file rules
  (TD-048): low severity, since only administrators can configure this and every upload is
  malware-scanned regardless of allowed type either way.

## Performance debt documented, not fixed

**Analytics dashboard query fan-out** (TD-046): admin/mentor analytics dashboards make O(students ×
courses) database queries in the worst case, by reusing a per-course progress-computation method
once per item instead of batching. Cheap at current data volumes; will need query batching before
scaling to a large student/mentor population. Not refactored in Sprint 13 because the affected code
(`ProgressService.getCourseProgress`) is heavily relied upon (recommendations, three analytics
dashboards, mentoring) and a behavior-preserving rewrite under an audit sprint's time budget, with no
dedicated regression-test cycle, was judged a worse risk/reward trade than documenting it precisely.

## Feature-level gaps carried from earlier sprints (unchanged by Sprint 13)

These are pre-existing, already-documented gaps, listed here only so a release reviewer doesn't have
to cross-reference the full 45-entry Technical Debt Register to find the ones most relevant to a
first production deployment:

- No caching layer anywhere (recommendations, permission lookups) — every request recomputes from
  the database (TD-014, TD-043).
- Scheduled report emails don't attach the generated file — recipients must open the live dashboard
  (TD-042).
- No CMS content-editor/reviewer role distinct from the publisher — the same administrator can
  author and approve their own content (TD-045).
