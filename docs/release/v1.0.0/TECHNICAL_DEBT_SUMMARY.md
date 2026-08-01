# Technical Debt Summary — v1.0.0

This is a curated rollup of `docs/TECHNICAL_DEBT_REGISTER.md` (the authoritative, living source —
consult it directly for full descriptions and resolution plans). Every number below was counted
programmatically from the register's actual table structure, not estimated.

## Headline numbers

- **45 entries** in the active register (`TD-001`–`TD-049`, accounting for gaps where an ID was
  retired), of which **39 are Open** and **6 are Resolved**
- A separate, smaller **4-entry historical "Resolved" log** (`TD-008`, `TD-009`, `TD-011`, `TD-012`)
  predates the current register format and is kept for record-keeping
- Priority split of the 45 active entries: **2 P1** (blocks release), **18 P2** (address before
  general availability), **25 P3** (address opportunistically)

## The 2 P1 items — one open, one already resolved

Only **one P1 item is currently open**: everything else in the register, including the platform's
only other-ever P1 (TD-024, a `@Global()`-module unhandled-rejection crash bug from Sprint 5), has
already been fixed.

| ID     | Status              | Summary                                                                                                    | Why it matters                                                                                                                                                             |
| ------ | ------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TD-049 | **Open**            | Docker images for `apps/web`/`apps/admin` bake `NEXT_PUBLIC_*` values in blank (no build-arg plumbing yet) | The images build and run, but a browser loading one would call the wrong/empty API origin — genuinely blocks using these specific images in a real deployment until closed |
| TD-024 | Resolved (Sprint 5) | `ClamAvScannerService.onModuleInit()`'s unhandled background-init rejection could crash the whole process  | Fixed with a `.catch()` + cache-clear-on-failure; kept here as the register's only other P1, for context                                                                   |

## What Sprint 13 changed

- **Resolved this sprint**: TD-010 (Docker `output: "standalone"` — found to be broken by two bugs,
  both fixed and verified via real `docker build`/`docker run`)
- **New entries added this sprint**: TD-046 (analytics dashboard query fan-out, documented not
  fixed — see rationale in ADR-0023), TD-047 (OAuth access token transits a URL query string),
  TD-048 (no system-wide dangerous-mimetype floor beneath admin-configured file rules), TD-049
  (Docker images bake blank `NEXT_PUBLIC_*` values — see P1 table above)
- **Updated with new context**: TD-007 (CI still doesn't build/push Docker images, but those images
  are now verified buildable for the first time, narrowing what remains to close it)

## The 18 P2 items, by theme

Full detail is in the register; grouped here for a release-readiness skim:

- **Observability gap** (TD-003): no Prometheus/Grafana/Loki/OTel/Sentry — structured JSON stdout
  logging only. The single biggest gap for operating this in real production, since there is
  currently no way to alert on errors or trace a slow request without reading raw logs.
- **No CD pipeline** (TD-007): CI lints/typechecks/builds/tests but never builds or pushes a Docker
  image, let alone deploys one.
- **Delivery gaps acknowledged by design**: scheduled reports don't attach their generated file
  (TD-042), no click-through tracking on recommendations (TD-044), no caching layer for
  recommendation computation (TD-043) or permission lookups (TD-014).
- **Security hardening deferred with rationale**: TD-047 (OAuth token in URL, needs a testable
  redesign), TD-049 (Docker build-arg plumbing for public config).
- **Everything else in this tier** is a scoped, self-contained gap (e.g. TD-015's GoogleStrategy
  always registering with placeholder credentials when unconfigured) — see the register for the
  complete list with locations and resolution plans.

## The 25 P3 items

Opportunistic — mostly narrower caching opportunities, minor role-model gaps (e.g. TD-045's lack of
a dedicated CMS content-editor/reviewer role distinct from the publisher), and the newly-added
TD-046 (analytics query batching) and TD-048 (file-rules mimetype floor). None block a v1.0.0
release; each has a documented trigger condition for when it's worth picking up (e.g. "once real
usage data shows query volume is a problem").

## How to use this document

This summary is a snapshot at v1.0.0 release time — it will drift as new sprints add or resolve
items. Always cross-reference `docs/TECHNICAL_DEBT_REGISTER.md` directly for current state; this
file exists to make the release decision legible at a glance, not to replace the register as the
source of truth.
