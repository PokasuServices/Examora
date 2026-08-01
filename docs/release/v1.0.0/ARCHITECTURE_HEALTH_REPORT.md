# Architecture Health Report — v1.0.0 (Sprint 13)

Scope: `apps/api`'s 23 feature modules, the Prisma schema, and cross-cutting DI/module-boundary
patterns. Performed as a full-repository audit (module-by-module import graph trace, provider/export
cross-check, schema read-through), not a sample.

## Module boundaries & dependency graph: clean

Every `*.module.ts`'s `imports: [...]` array was traced into a full adjacency list. Result: **a
strict DAG with no circular dependencies and no near-cycles**, with a clear topological layering:

```
Enrollment/Users (base, deliberately dependency-free)
  -> Assessment/Assignments/Learning/Commerce/Admin/Auth
    -> Community/Mentoring
      -> Analytics
        -> Recommendations
```

`EnrollmentModule` is intentionally kept import-free (own doc comment explains why: avoiding a cycle
with Learning/Assessment/Assignments/Commerce, all of which need to check enrollment/entitlement).
`RecommendationsModule` (the module with the widest fan-in, depending on Learning/Assessment/
Assignments/Community/Mentoring/Analytics) does not create a cycle with any of them — none of its
dependencies, transitively, depend back on it.

Two service-level comments that _look_ like cross-module references on a casual grep turned out to
be documentation-only mentions, not actual imports (`community/common/community-access.service.ts`
mentions `MentorAssignmentService` in a comment; `audit/audit.service.ts` mentions `AuthService` in a
comment) — verified by reading both files in full, not just grepping.

## Dependency injection: no anti-patterns found

- Zero instances of `new SomeService(...)` bypassing Nest's DI container outside test files and
  legitimate SDK client construction (S3 client, email/SMS provider clients, Razorpay client,
  ClamAV client — all correctly _not_ Nest-managed classes).
- Zero duplicate provider registrations across all 23 modules — every controller/service/processor
  class name and every port token (`STORAGE_PORT`, `MALWARE_SCANNER_PORT`, etc.) is bound in exactly
  one module.
- Seven `@Global()` modules (`Prisma`, `Redis`, `Storage`, `MalwareScan`, `Audit`, `Permissions`,
  `Notification`), each exporting only what it needs to (Notification's export list was trimmed
  during this sprint — see below).

## Fixed during this sprint

- **`AuthModule` exported `AuthService`** to the whole app, but no other module ever imported
  `AuthModule` — removed. Zero behavior change (nothing outside `auth/` consumed it).
- **`NotificationModule` exported `NotificationPreferencesService` and
  `WebPushSubscriptionsService`** app-wide, but both are only ever injected into their own
  controllers (already in the same module) — trimmed to just `NotificationsService` and
  `NotificationQueueService`, the two with real external consumers.

## Prisma schema: 69 models, spot-checked for consistency

- Consistent `camelCase` field / `@map("snake_case")` column convention throughout, no exceptions
  found.
- `onDelete` strategy reviewed for compliance-sensitive tables: `AuditLog.actor` uses `SetNull`, not
  `Cascade` — deleting a user does not delete their audit trail, only detaches the actor reference.
  This is the correct choice for an audit log and was verified explicitly, not assumed.
- The one raw-SQL usage in application code (`prisma.health.ts`'s `SELECT 1` liveness probe) is a
  narrower, different category of exception than the views/materialized-views/stored-procedures
  ADR-0007 was written to cover — a standard, parameterless connectivity check, not a query that
  could have been expressed in Prisma's DSL. Not a violation of the ADR's intent, but the ADR's
  wording ("never as ad-hoc queries inside application code") is stricter than the actual codebase;
  worth a one-line amendment in a future documentation pass.
- Six indexes added this sprint (see Performance section of the Production Readiness Report) —
  `AssignmentReview` had zero indexes at all before this pass despite being queried by
  `reviewerId` in two analytics services.

## ADR consistency

23 ADRs reviewed for internal consistency and consistency against the current implementation.
D-56/D-57 in `docs/DECISIONS_AND_ASSUMPTIONS.md` already document and resolve the two cases where a
sprint's actual delivered content diverged from the previously-planned roadmap entry (Sprint 11, 12)
— both correctly left the roadmap's phase structure untouched and updated only the Sprint Backlog
entry, per explicit Product Owner instruction. No unresolved or undocumented ADR-vs-implementation
contradictions were found beyond the ADR-0007 wording note above.

## Verdict

**Architecture is in good health for a v1.0.0 release.** No circular dependencies, no DI
anti-patterns, a consistent and well-documented schema, and an ADR trail that accurately reflects
what was actually built. The two findings fixed this sprint were hygiene (unused exports), not
structural risk. The one open architectural debt item most relevant to future scaling is TD-046
(analytics dashboards' query fan-out pattern) — documented, not fixed, with an explicit rationale for
deferring a deeper refactor past this sprint's time budget.
