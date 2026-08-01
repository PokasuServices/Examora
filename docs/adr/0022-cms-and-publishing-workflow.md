# ADR-0022: CMS & Publishing Workflow

Status: Accepted (2026-07-31)

## Context

Sprint 12's kickoff asks for a general-purpose publishing workflow (Draft → Review → Approval →
Publish → Archive), version history (compare/restore), scheduled publish/unpublish, preview mode, a
media library with asset reuse, and five new marketing-content types (Landing Pages, Static Pages,
FAQ, Announcements, Banner Management), plus improved CMS search — reusing existing services and not
duplicating business logic.

As with Sprint 11 (D-56), the kickoff's content — "CMS & Publishing Workflow" — does not match the
currently-documented Sprint 12 ("Scoring, Reports & Recommendations v0", moved there by D-55) and the
kickoff again says "Do not modify the roadmap." Applying the same resolution the user already gave
for D-56: `SPRINT_BACKLOG.md`'s Sprint 12 entry is updated to describe what was actually built;
`IMPLEMENTATION_ROADMAP.md`'s phase structure is left untouched; "Scoring, Reports & Recommendations
v0" joins "Growth Modules, Full Admin & Creative Gallery" as unplaced scope for a future sprint (see
D-57). This sprint did not re-ask the question since the user already established the pattern.

The five new content types (landing pages, static pages, FAQ, announcements, banners) are distinct
from the existing `Category → Course → Subject → Topic → Module → Lesson` hierarchy (Sprint 2,
ADR-0012) — they are marketing/site content, not curriculum content, and are public-facing (readable
without authentication) rather than enrollment-gated.

## Decisions

### 1. A new `CmsModule`, not an extension of `ContentModule`

`ContentModule`'s `ContentStatus` (DRAFT/PUBLISHED/ARCHIVED) and its permission codes
(`content:manage`/`content:publish`) govern the curriculum hierarchy specifically — its services
(`CatalogService`, course/subject/topic/module/lesson CRUD) have no notion of Review/Approval,
versioning, or scheduling, and retrofitting those onto Sprint 2's model would be a large, risky
change to existing functionality that no requirement asks for. A new `CmsModule` with its own
`CmsWorkflowStatus` enum (`DRAFT`, `IN_REVIEW`, `APPROVED`, `PUBLISHED`, `ARCHIVED`) and permission
codes (`cms:manage`, `cms:publish`) keeps the two content systems independent. `content:manage`'s
existing DRAFT/PUBLISHED/ARCHIVED model is left completely unmodified.

### 2. Landing Pages and Static Pages are one model (`CmsPage`), not two

Both are the same shape — slug, title, body, SEO fields — differing only in a `pageType` discriminator
(`LANDING` | `STATIC`) and where they're linked from. Modeling them separately would duplicate
identical CRUD, versioning, and workflow logic across two nearly-identical services; a single
`CmsPagesService` serving both, filtered by `pageType`, satisfies "Do not duplicate business logic"
directly.

### 3. One generic `CmsContentVersion` table backs versioning for every content type

Rather than a separate version-history table per content type (Pages, FAQ, Announcements, Banners),
`CmsContentVersion` uses a `(contentType, contentId)` discriminator and stores a full JSON snapshot
per version. A single `CmsVersioningService` (`recordVersion`, `compareVersions`, `restoreVersion`)
serves all four content types — Content Version History, Compare Versions, and Restore Version are
implemented exactly once, not duplicated per content type. Every save creates a new version snapshot
before overwriting the live row; restoring writes a _new_ version (the restored state), never mutates
history.

### 4. Scheduled Publish/Unpublish reuses the existing BullMQ delayed-job pattern

`scheduledPublishAt`/`scheduledUnpublishAt` columns plus a `CmsSchedulingQueueService` that enqueues
a one-time delayed BullMQ job (mirroring `NotificationQueueService.scheduleNotification`, Sprint 9)
to flip `status` at the scheduled time — not a repeatable scheduler (ADR-0020 §5's
`upsertJobScheduler`), since a publish/unpublish date is a single point in time, not a cadence.
Re-saving a draft cancels and re-enqueues the job if the scheduled time changed.

### 5. Media assets reuse `StoragePort` and the shared malware-scanner primitive

`CmsAsset` uploads go through the existing presigned-upload flow (`StoragePort`, ADR-0015) exactly
like assignment submissions. Scanning reuses the _same_ `MALWARE_SCANNER_PORT` primitive that both
assignment submissions and community attachments already share, via a new `CmsAssetScanQueueService`/
processor pair — mirroring the Community module's own attachment-scan pattern (its own queue/processor,
shared scanner) rather than either duplicating the ClamAV integration or forcing an assignment-specific
queue to accept a foreign job shape. Every asset defaults to quarantined (`FileScanStatus.PENDING`)
until scanned CLEAN, matching the platform's quarantine-by-default policy everywhere else. Asset reuse
is tracked by a `CmsAssetUsage` join table (`assetId`, `contentType`, `contentId`) populated whenever
content references an asset, answering "where is this asset used" without scanning JSON bodies.

### 6. Preview Mode is authenticated, not a public shareable link

Preview returns a content item's current draft/in-review state regardless of its live published
status, gated behind `cms:manage` like every other authoring action — not a signed public token.
Public shareable preview links are a real feature some CMSs offer, but they introduce a new
unauthenticated attack surface (token generation/expiry/revocation) that is explicitly out of scope
this sprint (security hardening is Sprint 13).

### 7. No new "content editor"/"reviewer" role — workflow _stages_ are tracked, not duties

`cms:manage` and `cms:publish` are both ADMINISTRATOR-only for this sprint (no existing `RoleName`
fits a marketing-content editor/reviewer, and adding one is a bigger structural change than this
sprint's scope asks for). Draft → Review → Approval → Publish → Archive is a real state machine with
a full audit trail (who drafted, who approved, who published, when) — separation of _stages_ is
implemented in full; separation of _duties_ (a different person performing each stage) is not
enforced, since the same ADMINISTRATOR can legitimately perform every step. Tracked as TD-045.

### 8. Public reads use the existing `@Public()` decorator; authoring is RBAC-gated

`GET` endpoints for PUBLISHED pages/FAQ/announcements/active banners are marked `@Public()` (the
existing, established opt-out from the global `JwtAuthGuard` — already used for `/auth/*`,
`/health/*`) since marketing content is meant for logged-out visitors. Every mutating and
non-published-read endpoint stays behind `cms:manage`/`cms:publish`.

### 9. CMS search reuses `CommunitySearchService`'s keyword-search pattern, not new infrastructure

A new `CmsSearchService` searches PUBLISHED pages/FAQ/announcements via the same
`contains`/`mode: "insensitive"` Prisma pattern `CommunitySearchService` already uses (Sprint 7) —
consistent with TD-031's existing acknowledgment that full-text search/relevance ranking is deferred
platform-wide, not a new gap introduced here.

## Consequences

- Four new content types share one workflow engine and one versioning engine — adding a fifth CMS
  content type in a future sprint is a small, well-worn extension, not a new subsystem.
- No content-editor/reviewer role separation (TD-045) — acceptable for v0, since the workflow _state
  machine_ and its audit trail are fully real and enforced regardless of who performs each step.
- Preview links cannot be shared externally (e.g. with a non-admin stakeholder) without giving them a
  full admin account — a real limitation, tracked alongside TD-045 if it becomes a blocker.

## Alternatives Considered

- **Extending `ContentStatus`/`ContentModule` for the new content types** — rejected: mixes an
  unrelated content system into Sprint 2's stable curriculum model for no requirement that asks for
  it, and DRAFT/PUBLISHED/ARCHIVED has no room for Review/Approval without changing existing code
  paths that depend on exactly three states.
- **Separate version tables per content type** — rejected as direct duplication of identical
  schema/service logic four times over.
- **Public signed preview-link tokens** — rejected this sprint; security hardening (token
  lifecycle/revocation) is explicitly Sprint 13's scope.
