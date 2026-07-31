# ADR-0020: Analytics & Reporting

Status: Accepted
Date: 2026-07-30
Deciders: Engineering (Sprint 10 kickoff)

## Context

Sprint 10 ("Analytics & Reporting," pulled forward from the original Sprint 12 slot — see D-55)
asks for role-scoped dashboards (student/mentor/admin), a report builder with CSV/PDF export, a
scheduled-reports foundation, and dashboard visualization (cards/charts/trend graphs/tables/KPIs).
The kickoff is explicit: reuse existing modules only, do not duplicate business logic, and treat AI
recommendations / CMS enhancements / performance optimization / security hardening / production
deployment as out of scope.

Every number this sprint needs to show already exists somewhere in the database — a `QuizAttempt`
row, an `AssignmentSubmission`/`AssignmentReview` pair, an `Enrollment`, an `Order`, a
`NotificationDelivery`. There is no new domain concept to model; the entire sprint is a read-only
aggregation layer over Sprints 1-9's data.

## Decisions

### 1. `AnalyticsModule` is a leaf module, not `@Global()`

Unlike `AuditModule`/`NotificationModule`, nothing needs to inject an analytics service from
another module — analytics only ever _reads_ other modules' data, nothing reads analytics data
back into a business flow. It sits at the top of the DI graph (mirrors `CommunityModule`'s
position): no other feature module's `imports` array; it reaches every table it needs directly
through the already-global `PrismaService`, the same reuse pattern `MentoringModule`'s Student 360
aggregator already established for cross-module reads (ADR-0016) — analytics needs aggregate
(`count`/`groupBy`/`aggregate`) queries a business service's own list/detail methods don't expose,
so it queries the tables directly rather than calling into e.g. `EnrollmentService`.

### 2. Read-only aggregation, no new business logic, no ETL pipeline

Every analytics method is a Prisma `count`/`aggregate`/`groupBy` query (occasionally raw SQL per
ADR-0007, only where Prisma's query builder genuinely cannot express something efficiently — e.g. a
single multi-table platform-summary query — each such case commented with its DB-34 §6
justification). No event log, no star schema, no materialized ETL tables. ANALYTICS-12 §10 itself
frames "ETL-ready/star-schema-compatible" as a _foundation for Phase 6_, not this sprint's
deliverable — Phase 6 (Intelligence) is explicitly deferred platform-wide until Phase 1-5 are in
production generating real usage data. Building a real warehouse now, against synthetic/dev data,
would be waste.

### 3. Three permission codes, mirroring the `:own`/mentor/admin split every prior sprint used

- `analytics:read:own` — baseline (every role): a student's own learning/quiz/assignment analytics.
  Mirrors `profile:read:own`.
- `analytics:mentor` — MENTOR-role only, added to `MENTOR_PERMISSION_CODES` alongside
  `mentor:workflow`: a mentor's dashboard over _their own assigned students only_
  (`MentorAssignment` where `mentorId = caller` and `unassignedAt IS NULL`), ownership enforced in
  the service layer exactly like `mentor:workflow`'s existing endpoints (ADR-0016) — the guard is
  AND-only and ADMINISTRATOR already holds every code, so per-request ownership checks are still
  required in the service, not just the guard.
- `analytics:admin` — ADMINISTRATOR-only: every cross-user/cross-course platform dashboard, and all
  of Report Builder / exports / scheduled reports.

### 4. CSV/PDF export is computed on demand and streamed — no persistence, no `StoragePort` change

`GET /admin/reports/:type/export?format=csv|pdf&...filters` runs the same query the on-screen
report uses and streams the result directly as the HTTP response (`Content-Disposition: attachment`),
rather than writing a file to object storage and handing back a presigned URL. This avoids adding a
`putObject`-style method to `StoragePort` (currently presigned-upload/read/delete only, ADR-0015) for
a capability only this one feature would use, and keeps every export byte-for-byte consistent with
what the requester was looking at — there is no intermediate stored artifact that could drift.

CSV is hand-built (field-escaping only — no new dependency, matching how the rest of the codebase
avoids dependencies for trivial string work). PDF uses `pdfkit` (new `apps/api` dependency): a
well-established, actively maintained, pure-Node PDF generator with no native/browser dependency —
deliberately not Puppeteer/headless-Chrome, which would be a heavy, flaky addition for what is
fundamentally tabular/text output.

### 5. Scheduled Reports is a real foundation, with one explicit, documented limitation

A new `ScheduledReport` model (owner, report type, filters, cadence, format, `isActive`,
`lastRunAt`/`nextRunAt`) backs simple CRUD plus a BullMQ **repeatable** job (new queue
`scheduled-reports`, same `@nestjs/bullmq` infrastructure as every other queue this platform uses —
Sprint 5's malware-scan queue, Sprint 9's notification queues). On fire, the processor runs the
report query and calls `NotificationsService.enqueue()` (Sprint 9) with a summary of the results —
**it does not attach the CSV/PDF file**, because `EmailChannelPort.send()` has no attachment
parameter today and adding one is out of proportion to "foundation" scope. This is the sprint's one
deliberate scope boundary; recorded as TD-042 (below) rather than silently shipped. An admin can
still open the live dashboard or run the on-demand export (Decision 4) to get the actual file — the
scheduled job's job is only to _remind_ them a fresh cut is ready, on a cadence, without them having
to remember to check.

A "run now" endpoint (ADMINISTRATOR-only) triggers a scheduled report's job immediately, both for
admin convenience and so the whole pipeline is provably exercisable in tests without waiting for a
real BullMQ repeatable-job interval to elapse.

### 6. Frontend: `recharts` for charts, one dependency, both apps

Neither `apps/web` nor `apps/admin` has a charting library yet (`packages/ui` is primitive
placeholders only, TD-001). `recharts` is added to both — a common, well-maintained, React-native
(SVG, no canvas/WASM) charting library that composes cleanly with existing Tailwind-styled
components, rather than hand-rolling SVG/canvas charts or pulling in a heavier full-dashboard
framework. Dashboard "cards"/"tables"/"KPIs" are plain React components in the existing
`packages/ui`/Tailwind style — no new primitive needed there.

### 7. Where each dashboard lives

- **Student** (`analytics:read:own`): `apps/web` — a single `/analytics` page (own progress,
  completion, quiz/assignment performance, timeline, activity, achievements) rather than seven
  separate routes; sections within one page, matching how `/dashboard` already aggregates several
  concerns for a student.
- **Mentor** (`analytics:mentor`): `apps/admin` (mentors already use the admin app since Sprint 6 —
  `/mentor-dashboard`, `/mentors/dashboard`) — a new `/mentor-analytics` page scoped to the caller's
  own assigned students.
- **Admin** (`analytics:admin`): `apps/admin` — `/analytics` (platform dashboard + the other nine
  admin analytics areas, tabbed, mirroring `NotificationsNav`'s sub-nav pattern from Sprint 9) and
  `/reports` (report builder, export, scheduled reports CRUD).

## Consequences

- One new Prisma model (`ScheduledReport`) and two new enums (`ReportType`, `ReportCadence` —
  `ReportFormat` reuses a plain two-value check rather than a third enum, CSV/PDF only).
- `apps/api` gains `pdfkit` (+ `@types/pdfkit`); `apps/web` and `apps/admin` gain `recharts`.
- Every analytics query is a fresh read against live tables — no caching layer this sprint. At
  current (dev/staging) data volumes this is fine; if a platform-dashboard query becomes measurably
  slow against production-scale data, that is a Phase 5 (PERF-32) concern, not this sprint's.
- TD-042 (email delivery for scheduled reports has no attachment support) is recorded as an explicit,
  intentional Sprint 10 boundary rather than silently shipped.

## Alternatives Considered

- **A dedicated analytics/read-replica database or materialized-view warehouse** — rejected for this
  sprint per ANALYTICS-12 §10's own framing ("foundation for Phase 6, not full BI yet") and D-55's
  no-new-scope constraint; revisit once Phase 1-5 are in production generating real usage data.
- **Server-rendered PDF via headless Chrome (Puppeteer)** — rejected: heavier dependency (bundles a
  full Chromium), flakier in CI/containers, and unnecessary for what is fundamentally
  tabular/paragraph output that `pdfkit` renders directly.
- **Storing exports in object storage and returning a presigned download URL** (matching the
  assignment-submission upload pattern) — rejected: adds a new `StoragePort` capability
  (`putObject`) for a single caller, and introduces a stored artifact that can silently drift from
  the live dashboard between generation and download. Streaming on demand keeps the two identical
  by construction.
