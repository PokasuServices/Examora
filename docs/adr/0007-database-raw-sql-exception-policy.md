# ADR-0007: Raw-SQL Exception Policy for Views, Materialized Views and Stored Procedures

Status: Accepted
Date: 2026-07-18
Deciders: Engineering

## Context

MDG-00 §8 states "No raw SQL unless justified." `34_Complete_Database_Physical_Design_and_SQL_DDL`
§6 mandates reporting views, materialized summaries, and stored procedures "only for justified
transactional logic." Prisma's schema DSL cannot author views, materialized views, or stored
procedures directly (Prisma Client can query views once introspected, but their DDL must be
hand-written).

## Decision

Database objects that Prisma cannot express — views, materialized views, stored procedures, and
advanced index types (GIN/full-text, partial indexes) — are the standing "justified" exception to
MDG-00's raw-SQL rule. These are authored as raw SQL inside Prisma migration files
(`database/migrations/<timestamp>_<name>/migration.sql`, hand-edited after `prisma migrate dev
--create-only`), never as ad-hoc queries inside application code. Application code continues to
query exclusively through Prisma Client (including introspected views, once Prisma's `views`
preview feature is enabled when the first view is needed).

## Consequences

- Sprint 0's schema has no views/procedures yet (identity/audit tables only) — this ADR takes effect
  starting with the Learning/Assessment reporting tables (later sprints).
- Every hand-written migration SQL file must include a comment header stating which document/section
  justifies it (e.g., `-- Justified by DB-34 §6: reporting view for topic-mastery analytics`).
- Rollback scripts must be written by hand alongside any raw-SQL migration, since Prisma cannot
  auto-generate a down-migration for non-DSL objects.

## Alternatives Considered

- **Avoid views/procedures entirely, do all aggregation in application code**: rejected — conflicts
  directly with DB-34 §6's explicit requirement and would push expensive aggregation into the NestJS
  process instead of the database.
