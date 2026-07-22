# Examora Platform

AI-powered exam preparation and mentoring platform for design/fashion/architecture/aptitude
entrance exams. Governed by [`documents/00_Master_Development_Guide_Examora_Platform_MDG-00.docx`](documents/00_Master_Development_Guide_Examora_Platform_MDG-00.docx).

## Status

**Sprint 7 — Community & Discussion Module (complete).** Students browse admin-managed forum
categories/boards and post threads — a "thread" is either a plain discussion or a Doubt Resolution
question (`type: DISCUSSION | QUESTION`), the same underlying model rather than two parallel
systems. Replies nest under one another; a question's author (or a moderator) can accept one reply
as the answer, marking the thread solved. Likes (threads and replies), bookmarks, and follows are
supported, alongside a thin reputation foundation (a denormalized point total backed by an
append-only ledger — no badges/levels yet) and a merged community activity timeline. Anyone can
report a thread or reply; `community:moderate` (admin-only this sprint) reviews the report queue and
can hide/restore, lock/unlock, and pin/unpin threads independently of one another (a thread can be
simultaneously pinned, locked, and closed). Search is keyword-based (Prisma `contains`, no full-text
index yet). Image/document attachments on threads/replies reuse Sprint 5's presigned-upload +
quarantine-by-default malware-scanning ports as-is, via a second, duplicated BullMQ scan queue bound
to the new attachment table. See [ADR-0017](docs/adr/0017-community-discussion-module.md) for the
full design. Builds on Sprint 6 (Mentor Management: mentor profiles, history-preserving mentor↔
student assignment, Student 360, mentor workflow), Sprint 5 (Creative Assignment Engine: assignment
authoring/templates, presigned upload + quarantine-by-default malware scanning, rubric review),
Sprint 4 (Assessment & Quiz Engine: question bank, quiz authoring, timed autosaving attempts,
automatic scoring, attempt monitoring), Sprint 3 (Learning Engine: published-only catalog, lesson
viewer/completion, progress dashboard, no enrollment gate), Sprint 2 (Course Management: the
`Category → Course → Subject → Topic → Module → Lesson` content hierarchy, DRAFT/PUBLISHED/ARCHIVED
workflow, CRUD/reorder APIs, admin content UI), and Sprint 1 (Authentication & Identity:
registration, email verification, login/logout, refresh rotation, password reset, sessions, RBAC +
permissions, profiles, Google OAuth, consent, audit). A dedicated non-admin MODERATOR role, full-text
search, and the creative gallery/peer-rating/XP half of the original community scope are explicitly
deferred (see TD-030/TD-031 and the Sprint 9 backlog entry). Payments, notifications, analytics, AI
and further CMS enhancements are not started. See
[`docs/roadmap/SPRINT_BACKLOG.md`](docs/roadmap/SPRINT_BACKLOG.md) for the full plan.

> Malware scanning and object storage run against real ClamAV/S3-compatible (MinIO) adapters in
> dev/prod, but every automated test uses fake in-memory adapters instead (ADR-0015) — the real
> adapters are only manually verified, not CI-covered (TD-027).

> Email is not actually delivered yet — Sprint 1 uses a console-logging mailer stub (ADR-0009);
> verification/reset tokens appear in the `apps/api` logs. Real delivery arrives with the
> Notification Service in Sprint 9.

### First administrator

Self-registration only ever grants the STUDENT role. To create the first administrator, promote a
registered user directly in the database:

```sql
UPDATE user_roles SET role_id = (SELECT id FROM roles WHERE name = 'ADMINISTRATOR')
WHERE user_id = (SELECT id FROM users WHERE email = 'you@example.com');
```

Then re-login to pick up the new role, and visit the admin app at http://localhost:3002.

## Repository Structure

```
apps/
  web/        Student & public-facing Next.js app
  api/        NestJS backend API
  admin/      Admin portal Next.js app
packages/
  ui/          Shared React component library
  shared/      Shared business constants/logic
  types/       Shared TypeScript types/DTOs
  utils/       Shared utilities
  auth-client/ Shared React auth context + API client (AuthProvider/useAuth) for web + admin
database/     Prisma schema, migrations, seed (workspace package @examora/database)
docs/         ADRs, roadmap, checklists, decisions log — see below
infra/        Infrastructure as code (added from Sprint 2+)
scripts/      Build/maintenance scripts
documents/    Governing specification documents (source of truth for requirements)
screens/      Competitor reference screenshots — functional reference ONLY, see ADR-0008
```

## Documentation

- [`docs/adr/`](docs/adr/) — Architecture Decision Records
- [`docs/roadmap/IMPLEMENTATION_ROADMAP.md`](docs/roadmap/IMPLEMENTATION_ROADMAP.md) — phase-level plan
- [`docs/roadmap/SPRINT_BACKLOG.md`](docs/roadmap/SPRINT_BACKLOG.md) — sprint-by-sprint backlog
- [`docs/DEVELOPMENT_CHECKLIST.md`](docs/DEVELOPMENT_CHECKLIST.md) — DoR/DoD and per-feature checklists
- [`docs/TECHNICAL_DEBT_REGISTER.md`](docs/TECHNICAL_DEBT_REGISTER.md) — tracked shortcuts and gaps
- [`docs/DECISIONS_AND_ASSUMPTIONS.md`](docs/DECISIONS_AND_ASSUMPTIONS.md) — decisions/assumptions log

## Prerequisites

- Node.js >= 20 (see `.nvmrc`)
- pnpm >= 9 (`corepack enable` will pick up the pinned version from `package.json#packageManager`)
- Docker + Docker Compose (for local Postgres/Redis/MinIO)

## Getting Started

```bash
pnpm install
cp .env.example .env          # fill in local values
docker compose up -d          # starts Postgres, Redis, MinIO (add `clamav` too for real malware scanning — optional, see TD-027)
pnpm db:migrate                # applies Prisma migrations
pnpm dev                       # runs api (3001), web (3000), admin (3002) in parallel
```

- API: http://localhost:3001/api/v1, Swagger at http://localhost:3001/api/docs, health at
  http://localhost:3001/health
- Web: http://localhost:3000
- Admin: http://localhost:3002
- MinIO console: http://localhost:9001

## Common Commands

```bash
pnpm build          # build all workspaces
pnpm lint            # lint all workspaces
pnpm typecheck       # typecheck all workspaces
pnpm test            # unit/integration tests
pnpm format          # format with Prettier
pnpm changeset       # record a changeset for a change
pnpm db:studio       # open Prisma Studio
```

## Engineering Standards

All contributors (human or AI) must follow `documents/00_Master_Development_Guide_Examora_Platform_MDG-00.docx`
and the checklists in `docs/DEVELOPMENT_CHECKLIST.md`. Every feature requires backend, frontend,
database migration, tests, Swagger documentation, RBAC enforcement, and audit logging — see
MDG-00 §21 (Feature Workflow) and §19 (Definition of Done).
