# ADR-0001: Monorepo Tooling — pnpm workspaces + Turborepo

Status: Accepted
Date: 2026-07-18
Deciders: Product Owner (approved via recommended default)

## Context

MDG-00 §4 mandates the repository shape (`apps/*`, `packages/*`, `database/*`, `infra`, `docs`,
`scripts`) but does not name a package manager or build orchestrator. The stack (Next.js x2,
NestJS, four shared packages) needs workspace-aware dependency management, incremental/cached
builds, and consistent task running (`lint`, `build`, `test`) across all workspaces.

## Decision

Use **pnpm** as the package manager (workspaces via `pnpm-workspace.yaml`) and **Turborepo** as the
task runner/build cache, orchestrated from a single root `package.json`.

## Consequences

- Fast, disk-efficient installs; strict dependency isolation between workspaces (pnpm does not
  hoist by default, which surfaces missing dependencies early).
- Turborepo gives per-task caching and dependency-graph-aware `build`/`lint`/`test` pipelines,
  which matters once `packages/*` are consumed by three apps.
- Team must have pnpm installed locally (or use Corepack); this is a new tool for anyone coming
  from npm/yarn-only backgrounds.

## Alternatives Considered

- **npm workspaces + Nx**: Nx is more opinionated/heavier than needed for a project this size at
  Sprint 0; revisit if the graph grows enough to need Nx's generators and remote caching.
- **Yarn Berry (PnP)**: stronger isolation than pnpm but worse ecosystem compatibility with some
  Next.js/NestJS tooling; not worth the friction.
- **No orchestrator, plain npm scripts**: rejected — would require hand-written topological build
  ordering across `packages/*` → `apps/*`.
