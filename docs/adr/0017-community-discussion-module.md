# ADR-0017: Community & Discussion Module — Data Model and Reuse Strategy

Status: Accepted
Date: 2026-07-22
Deciders: Engineering (Sprint 7)

## Context

Sprint 7 ("Community & Discussion Module") delivers discussion forums, doubt resolution (Q&A),
community features (comments, likes, bookmarks, follows, a reputation foundation, an activity
timeline), moderation, search, and attachments (FR-COMM-01/02, the discussion/moderation half of
what was originally bundled into a later "Notifications, Messaging & Community" sprint — see
D-52). Per the kickoff instruction ("review existing APIs and services; reuse existing modules
wherever possible and do not duplicate business logic"), this sprint reuses Sprint 5's file
upload/malware-scan ports, Sprint 1's RBAC/audit infrastructure, and Sprint 3/4/5's catalog
services for "related learning content" links, rather than rebuilding any of them.

## Decisions

**Forum threads and doubt-resolution questions are the same underlying model.** A `Thread` has a
`type: DISCUSSION | QUESTION`. A "question" in Doubt Resolution is a `Thread` with
`type = QUESTION`; an "answer" is a `Reply` to it. This is a deliberate DRY choice: both concepts
share the same shape (title, body, author, replies, comments-as-replies, likes, bookmarks, follows,
moderation actions, search) and building them as two parallel systems would duplicate every one of
those behaviors for no functional benefit. `Reply.isAcceptedAnswer` and `Thread.isSolved` are the
only fields meaningful exclusively to `QUESTION`-type threads; they are simply unused (`false`/
`null`) on `DISCUSSION`-type threads, the same "unused-but-present" trade-off already accepted for
`AssignmentSubmissionStatus` fields that don't apply to every state.

**"Topics" and "Comments" are not separate models.** The scope lists "Topics" alongside "Threads,"
and "Comments" alongside "Replies" — read as the forum hierarchy's colloquial naming rather than two
functionally distinct concepts (nothing in the requirement list needs a comment to behave
differently from a reply, or a topic to behave differently from a thread). Building a fourth
near-identical flat-text model would duplicate `Reply`'s create/edit/delete/like/moderate behavior
for a distinction with no behavioral difference — the same reasoning ADR-0015 used to keep
`AssignmentComment` singular rather than splitting it by context.

**Thread status is three independent dimensions, not one four-value enum**, despite the scope
listing "Thread Status (Open, Closed, Pinned, Locked)" as one bullet. `status: OPEN | CLOSED` is
the linear state (mirrors `ContentStatus`'s DRAFT/PUBLISHED/ARCHIVED shape); `isPinned` and
`isLocked` are independent booleans. A real forum needs a thread to be simultaneously pinned,
locked, and closed (e.g. an announcement) — forcing that into one mutually-exclusive enum would
make an unrepresentable state (PINNED excludes LOCKED) out of two states that must co-occur. This
matches how Discourse/phpBB model the same four concepts. `content-status.util.ts`'s
`assertValidStatusTransition` linear-transition-map pattern is reused for the `OPEN ↔ CLOSED`
transition only; pin/lock/hide are plain boolean toggles guarded by permission checks, not
transitions.

**Moderation state (hide/restore, soft-delete) reuses established patterns exactly.** `isHidden` +
`hiddenReason` (moderator-hidden, content still exists, restorable) is new to this sprint but
mirrors `isPinned`/`isLocked`'s boolean-toggle shape. `deletedAt` (soft delete/restore) is the same
column already used on `User`, `Content`, and `Assignment`.

**Ownership + moderation authorization reuses Sprint 6's `assertAssignedOrAdmin` two-branch shape,
renamed `assertOwnerOrModerator`.** An actor may edit/delete their own thread/reply, or bypass that
check entirely if they hold `community:moderate`. This is the same "row-ownership OR admin-tier
permission bypass" template already proven by `MentorAssignmentService.assertAssignedOrAdmin`
(Sprint 6) and `ReviewerService`'s assigned-reviewer check (Sprint 5) — not a new authorization
concept.

**RBAC stays minimal: `community:read` (baseline), `community:manage` (admin — forum category/board
CRUD), `community:moderate` (admin — hide/restore/delete/lock/unlock/pin/unpin, report review).**
No separate "community:write" permission — self-scoped actions (post a thread/reply/question/
answer, like, bookmark, follow, report) are authorized by `community:read` plus an ownership check
on mutation, the same "baseline permission covers reading and self-scoped writing" precedent
`assignment:read`/`quiz:read` already established (ADR-0013/0014). Only ADMINISTRATOR holds
`community:manage`/`community:moderate` this sprint — a dedicated MODERATOR role is deferred until
community scale actually demands delegating moderation away from admins (TD-030).

**Likes are a single polymorphic-lite table** (`CommunityLike { userId, targetType: THREAD | REPLY,
targetId }`, unique on the triple) rather than separate `ThreadLike`/`ReplyLike` tables — unlike the
Comments-vs-Replies decision above, a "like" is genuinely the same row shape and behavior regardless
of target type, and a shared table avoids duplicating the toggle-like/unlike logic twice. Reports
(`CommunityReport`) use the identical `targetType`/`targetId` shape for the same reason.

**Attachments duplicate Sprint 5's queue+processor pair rather than genericizing it.**
`StoragePort`/`MalwareScannerPort` (both `@Global()`, ADR-0015) are injected as-is into a new
`CommunityAttachmentsModule` — no changes to either port or their real/fake adapters. The BullMQ
queue+processor pair, however, is compile-time bound to `AssignmentSubmissionFile` (Sprint 5's
`MalwareScanProcessor` directly calls `prisma.submissionFile.findUnique`/`.update`) and cannot take
a table name as a runtime parameter without a disproportionate refactor of working Sprint 5 code
for a single sprint's benefit. A second, near-identical queue (`community-attachment-scan`) and
processor targeting the new `CommunityAttachment` table is duplicated instead — the expensive,
risk-bearing parts (the real S3 and ClamAV clients) are reused untouched; only the thin
enqueue/process orchestration is copied. `CommunityAttachment.scanStatus` reuses the existing
`FileScanStatus` enum (PENDING/CLEAN/INFECTED/FAILED) rather than a duplicate enum.

**Related learning content is four nullable direct FKs on `Thread`**
(`relatedCourseId`/`relatedLessonId`/`relatedQuizId`/`relatedAssignmentId`, each `onDelete:
SetNull`), not a polymorphic join table. A question realistically links to at most one piece of
content; four nullable columns are simpler to query than a join table for a single-item
relationship, and existence/visibility is validated at write time by reusing `CatalogService`
(Learning), `QuizCatalogService` (Assessment), and `AssignmentCatalogService` (Assignments)'s
existing published-content lookups — no new content-lookup logic.

**Reputation is a thin, auditable foundation, not a scoring engine.** `CommunityProfile` (1:1 `User`
extension, mirrors `MentorProfile`'s shape exactly) holds a denormalized `reputationPoints`
running total; every change is also recorded in an append-only `ReputationEvent` ledger
(userId, points, reason, createdAt) — the same "denormalized fast-read counter backed by an
append-only event log" shape `AuditLog` already established for every other disputable action in
this codebase. No levels, badges, or decay this sprint (explicitly foundation-only per the
kickoff).

**The Community Activity Timeline is a read-only aggregator, not a stored table** — identical
reasoning to Student 360's activity timeline (D-50, Sprint 6): merge-and-sort over a user's own
threads, replies, likes given, and reputation events, queried fresh on each request.

**Search is new code — nothing in the codebase does full-text/keyword search today.** MVP uses
Prisma `contains`/`mode: "insensitive"` filters (adequate for the sprint's scope); a
Postgres GIN/`tsvector` index is deferred until relevance ranking is actually needed (TD-031).

## Consequences

- `Thread`/`Reply` carry fields that are meaningless for the other `type` (e.g. `isSolved` on a
  `DISCUSSION` thread, `isAcceptedAnswer` on a reply to one) — an accepted, already-precedented
  trade-off (see `AssignmentSubmissionStatus`) in exchange for not building two parallel systems.
- A second BullMQ queue+processor pair now exists for malware scanning, duplicating ~40 lines of
  Sprint 5 orchestration code. Both processors depend on the same two global ports, so a future
  genericization (if a third file-upload feature ever appears) has a clear, minimal blast radius.
- `community:moderate` being ADMINISTRATOR-only means every moderation action funnels through
  admin accounts this sprint — acceptable at current scale, revisit if/when a dedicated community
  moderator role is needed (TD-030).

## Alternatives Considered

- **Separate `Question`/`Answer` models parallel to `Thread`/`Reply`**: rejected — duplicates every
  create/edit/delete/like/bookmark/follow/moderate/search behavior for the same underlying shape.
- **A single four-value `ThreadStatus` enum** (`OPEN`/`CLOSED`/`PINNED`/`LOCKED`) matching the
  scope's literal bullet: rejected — cannot represent a thread that is simultaneously pinned and
  locked, a state real forum moderation needs.
- **Genericizing `MalwareScanProcessor` to accept a table name**: rejected for this sprint — no
  clean way to parameterize a Prisma delegate at runtime without a disproportionate refactor;
  duplicating the thin orchestration layer while reusing the real adapters is cheaper and lower-risk.
- **A polymorphic join table for related learning content**: rejected — a question links to at most
  one piece of content in practice; four nullable FKs are simpler to write and query.
