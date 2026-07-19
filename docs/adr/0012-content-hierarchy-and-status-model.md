# ADR-0012: Content Hierarchy and Status Model

Status: Accepted
Date: 2026-07-19
Deciders: Engineering (Sprint 2)

## Context

Sprint 2 ("Course Management") delivers the learning-content taxonomy. CMS-29 §2 defines the
hierarchy as Course > Subject > Topic > Module > Lesson; the sprint scope adds Categories above
Course and specifies a "Course status (Draft, Published, Archived)". CMS-29 §4 describes a fuller
publish workflow (Draft / In Review / Approved / Published / Archived / Restored) and §5 describes
content versioning (revision history, compare, rollback). Neither the fuller workflow nor
versioning is in the Sprint 2 scope list.

## Decision

- **Hierarchy**: `Category → Course → Subject → Topic → Module → Lesson`, six Prisma models. Module
  is a container node; Lesson is the leaf content item carrying a `LessonContentType`
  (TEXT/VIDEO/PDF/IMAGE/ARTICLE per SRS-02 FR-CONTENT-02) plus a text `body` and/or `contentUrl`.
- **Status**: a single 3-state `ContentStatus` enum (DRAFT / PUBLISHED / ARCHIVED) applied
  **uniformly to all five learning-content levels** (Course, Subject, Topic, Module, Lesson). The
  sprint names it for Course; applying it uniformly is the clean way to satisfy FR-CONTENT-01's
  "create, draft, publish, unpublish … nodes" for every level without an asymmetric design.
  Categories are pure taxonomy (not learning content) and instead carry `isActive`.
- **Ordering**: an integer `position` on every node satisfies FR-CONTENT-01 "reorder"; a dedicated
  reorder endpoint accepts an ordered id list per collection.
- **Deferred, explicitly out of Sprint 2 scope**: the IN_REVIEW/APPROVED/RESTORED workflow states
  (CMS-29 §4) and content versioning / revision history / compare / rollback (CMS-29 §5). An
  optimistic-lock `version` integer is present per MDG-00 §10, but no revision snapshots are stored.
- **Authorship**: `createdById` (nullable Uuid, no formal relation) records content ownership
  (CMS-29 §11). The authoritative "who changed what, before/after" trail is the existing `AuditLog`,
  which every content mutation writes to — not per-row `updatedBy` columns.

## Consequences

- Publishing a course does not cascade-publish its children; each node's status is independent.
  Read APIs that serve students (later sprints) must filter to PUBLISHED at every level. Admin APIs
  see all statuses.
- Because versioning is deferred, editing published content mutates it in place; the AuditLog
  before/after state is the only historical record until CMS-29 §5 versioning is implemented.
- Slugs are unique globally for Category/Course and unique-within-parent for Subject/Topic/Module/
  Lesson, giving stable human-readable identifiers without exposing UUIDs in URLs.

## Alternatives Considered

- **Status only on Course** (literal reading of the sprint line): rejected — FR-CONTENT-01 requires
  publish/unpublish at the node level, and a Course-only status can't express "this topic is drafted
  but the course is published." Uniform status is simpler and more correct.
- **Single polymorphic `content_nodes` table** (self-referencing tree) instead of six tables:
  rejected — DB-16/DB-34 model these as distinct tables with typed foreign keys; per-level tables
  give clearer constraints, indexes, and DTOs, and match the physical design docs (which govern per
  MDG-00 §2).
- **Build versioning now**: rejected — explicitly outside the Sprint 2 scope list; deferred to a
  later CMS sprint (tracked in the technical debt register).
