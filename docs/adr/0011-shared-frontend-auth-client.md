# ADR-0011: Shared Frontend Auth Client Package (`@examora/auth-client`)

Status: Accepted
Date: 2026-07-18
Deciders: Engineering

## Context

Sprint 1 needs login/register/session-bootstrap UI in both `apps/web` and `apps/admin`. The logic —
silent session restore via the refresh cookie on page load, holding the access token in memory,
attaching it to API calls — is identical between the two apps and will keep being needed by every
future authenticated page. MDG-00 §6 lists DRY and "reusable modules only" as explicit development
principles.

## Decision

Extract this into `packages/auth-client`: a React context (`AuthProvider`/`useAuth`) plus a thin
`apiRequest` fetch wrapper matching the API-17 §5 response envelope, built the same way as
`packages/ui` (tsup, React peer dependency). Both apps wrap their root layout in `AuthProvider` and
consume `useAuth()` from pages/components.

## Consequences

- Session-bootstrap behavior (refresh-on-mount, token-in-memory, cookie-based persistence per
  ADR-0006) is defined exactly once — a bug fix or behavior change applies to both apps
  simultaneously.
- New authenticated pages (Sprint 2+) get `useAuth()` for free instead of re-deriving this logic.
- Access tokens are deliberately kept in React state only (never `localStorage`), consistent with
  ADR-0006's XSS-exposure reasoning for the original hybrid JWT/cookie design.

## Alternatives Considered

- **Duplicate a small auth hook in each app**: considered in Sprint 0 planning and rejected once
  Sprint 1 confirmed both apps need it — duplication was only defensible while it was hypothetical.
- **Put this in `packages/ui`**: rejected — `packages/ui` is presentational (DS-18 component
  catalog); auth state management is a different concern and would muddy that package's purpose.
