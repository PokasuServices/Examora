# ADR-0002: API-17 (OpenAPI Contract) as Authoritative API Specification

Status: Accepted
Date: 2026-07-18
Deciders: Product Owner

## Context

Two source documents describe the REST API: `06_REST_API_Specification_and_Endpoint_Design` and
`17_OpenAPI_Swagger_API_Contract_Specification`. They cover largely the same endpoint groups but
disagree on details — API-17 mandates `Idempotency-Key` and `X-Correlation-ID` headers and states
explicit versioning/deprecation rules that API-06 omits. MDG-00 §2 says "API specification governs
endpoint implementation" (singular) without naming which of the two that refers to.

## Decision

**API-17 is the authoritative, implementation-ready API contract.** API-06 is treated as a legacy
human-readable reference and is merged into API-17 where it adds information API-17 lacks (notably
API-06's per-endpoint role/actor table). Going forward, the live OpenAPI document generated from
`apps/api` (via `@nestjs/swagger`) is the single source of truth for the contract; API-06 and API-17
remain in `/documents` as historical inputs only.

## Consequences

- Backend controllers must declare `Idempotency-Key` handling for payment, scoring and submission
  endpoints from the first implementation, not as a later hardening pass.
- The generated Swagger/OpenAPI JSON (served at `/api/docs`) becomes the contract frontend and
  third parties integrate against — any breaking change requires the versioning/deprecation
  discipline from API-17 §8.
- API-06's role/actor table content should be reflected in NestJS `@ApiOperation`/RBAC guard
  documentation per endpoint so that information isn't lost.

## Alternatives Considered

- **API-06 as base**: rejected — it is less implementation-ready (no idempotency/correlation-ID
  header contract, no versioning policy).
- **Defer merge, keep both live**: rejected — two authoritative-looking specs invite silent drift;
  a single generated contract is safer for a project built substantially by AI coding agents.
