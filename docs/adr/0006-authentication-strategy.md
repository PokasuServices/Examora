# ADR-0006: Authentication Strategy — JWT Access Token + HttpOnly Refresh Cookie

Status: Accepted
Date: 2026-07-18
Deciders: Engineering (Sprint 0 scaffold decision)

## Context

SEC-13 §2 and SRS-02 NFR-SEC-01 allow either "JWT or secure session authentication" without
mandating one. The Sprint 0 scope requires a basic, extensible authentication skeleton (register,
login, refresh, logout) that later RBAC (SEC-13, DESIGN-03) and audit-logging requirements build on.

## Decision

Use a **short-lived JWT access token** (returned in the response body, held in memory/client state)
plus a **long-lived refresh token stored in a secure, HttpOnly, SameSite=Strict cookie**. Refresh
tokens are persisted server-side (hashed) in the `refresh_tokens` table so they can be revoked
individually (logout, password reset, admin-forced session termination) — this satisfies SEC-13's
requirement for auditable, revocable sessions while keeping API calls statelessly verifiable via the
JWT, matching BACKEND-19 §2 "stateless application servers."

## Consequences

- `apps/api` needs a `RefreshToken` Prisma model (hashed token, userId, expiresAt, revokedAt,
  userAgent/IP for audit) from Sprint 0, even though no business features ship yet.
- CSRF protection is required on any cookie-based endpoint (refresh, logout) per SEC-13 §5; the
  access-token-bearing endpoints (everything else) are CSRF-exempt since they require an
  `Authorization: Bearer` header, not just a cookie.
- Password hashing uses Argon2id (via the `argon2` package) per SRS-02 NFR-SEC-01 / SEC-13 §6.
- This is a reversible implementation detail, not a requirements decision — if load testing later
  favors pure stateless JWT (no refresh persistence) or a full session-store model, this ADR should
  be superseded rather than silently changed.

## Alternatives Considered

- **Pure stateless JWT (access + refresh, no server-side persistence)**: rejected — cannot satisfy
  SEC-13's requirement for auditable, individually revocable sessions.
- **Server-side session cookie only (no JWT)**: rejected — adds a shared session store dependency
  (sticky sessions or Redis-backed lookup on every request) that conflicts with the "stateless
  application servers" principle in BACKEND-19 §2 more than the hybrid approach does.
