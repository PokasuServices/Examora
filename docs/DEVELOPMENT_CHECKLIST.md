# Examora Platform — Development Checklist

Status: Living document. Source: MDG-00 §18-19, §21-22; DEV-23 §9-11; QA-15 §7-9.

## Definition of Ready (before a backlog item enters a sprint)

- [ ] Requirement approved and traceable to a source doc (FR-ID, BR-ID, or NFR-ID where applicable)
- [ ] Acceptance criteria defined and testable
- [ ] Dependencies identified (other services, migrations, external providers)
- [ ] UX design available where the item has a UI surface (original design per ADR-0008, not
      copied from `/screens`)
- [ ] Test approach identified (unit/integration/API/E2E per QA-15 §3)

## Per-Feature Workflow (MDG-00 §21)

1. Review specifications (identify every source doc touched)
2. Design (data model, API contract, RBAC scope)
3. Create migrations (Prisma schema change + generated/hand-written migration)
4. Implement backend (Controller → Service → Repository → DTOs → Validation → RBAC guard → Audit
   logging)
5. Implement frontend (component → page → loading/empty/error states → accessibility pass)
6. Write tests (unit, integration, API; E2E for full user journeys)
7. Update documentation (OpenAPI/Swagger, ADR if an architectural decision was made, this checklist
   if the process itself changed)
8. Verify acceptance criteria against the original requirement

## Backend Feature Checklist (MDG-00 §8)

- [ ] Controller with versioned route (`/api/v1/...`)
- [ ] Service (business logic, no direct DB access)
- [ ] Repository (Prisma-backed persistence; no raw SQL unless justified per ADR-0007)
- [ ] Request/response DTOs with `class-validator` decorators
- [ ] Server-side RBAC guard on every endpoint (no client-trust shortcuts)
- [ ] Audit logging on every privileged/sensitive action (actor, before/after, timestamp,
      correlation ID) — never omitted, per MDG-00 §14
- [ ] Idempotency-Key handling on payment, scoring, and submission endpoints (ADR-0002)
- [ ] Standard response envelope (`{success, data, message}` / `{success:false, error, correlationId}`)
- [ ] Unit + integration tests
- [ ] Swagger annotations (`@ApiOperation`, `@ApiResponse`, etc.) kept current

## Frontend Feature Checklist (MDG-00 §9)

- [ ] Responsive layout (mobile/tablet/desktop/wide per DS-18 §3)
- [ ] Loading, empty, error, and offline-recovery states (UX-07 §4)
- [ ] WCAG 2.1 AA: keyboard navigation, visible focus, ARIA labels, contrast
- [ ] Dark-mode ready (uses design tokens, not hardcoded colors)
- [ ] Built from reusable components in `packages/ui`, not one-off duplicated markup
- [ ] No visual asset, copy, or branding sourced from `/screens` (ADR-0008)

## Database Change Checklist (MDG-00 §10, DB-34)

- [ ] snake_case naming, UUID/BIGINT surrogate PK, `created_at`/`updated_at`/`deleted_at` where
      applicable
- [ ] Foreign keys indexed
- [ ] Soft delete used instead of hard delete where the entity has audit/retention requirements
- [ ] Migration is forward-only; rollback script included where feasible
- [ ] Raw SQL (views/procedures/advanced indexes) includes a comment citing the justifying doc
      section (ADR-0007)

## Definition of Done (MDG-00 §19, AGILE-20 §6)

- [ ] Code complete and peer-reviewed
- [ ] Automated tests passing (unit/integration/API, E2E where applicable)
- [ ] Swagger/OpenAPI updated
- [ ] Security reviewed (RBAC coverage, input validation, no secrets in code)
- [ ] Documentation updated (this checklist, relevant spec doc, ADR if applicable)
- [ ] Product Owner acceptance against the original acceptance criteria

## Commit / PR Checklist (DEV-23 §9-10)

- [ ] Conventional Commit format (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`)
- [ ] References the sprint backlog item / FR-ID
- [ ] All CI checks green (lint, typecheck, test, build)
- [ ] Peer review required before merge — no self-merge to `main`/`develop`

## Sprint 0 Exit Checklist (infrastructure only — no business logic)

- [ ] `pnpm install` succeeds from a clean clone
- [ ] `pnpm turbo build` succeeds across all workspaces
- [ ] `pnpm turbo lint` and `pnpm turbo typecheck` pass
- [ ] `docker compose up` starts Postgres, Redis, MinIO healthy
- [ ] `apps/api`: `/health`, `/health/live`, `/health/ready` return 200; `/api/docs` serves Swagger UI
- [ ] `apps/api`: register → login → refresh → logout works against a local Postgres instance
- [ ] `apps/web` and `apps/admin` boot and render a placeholder page each
- [ ] Husky pre-commit (lint-staged) and commit-msg (commitlint) hooks fire on a test commit
- [ ] GitHub Actions CI workflow runs on push/PR and mirrors the local `pnpm turbo` pipeline
- [ ] No business-domain module (courses, quizzes, assignments, mentoring, payments, etc.) present
