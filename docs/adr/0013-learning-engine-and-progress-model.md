# ADR-0013: Learning Engine and Progress Model

Status: Accepted
Date: 2026-07-19
Deciders: Engineering (Sprint 3)

## Context

Sprint 3 ("Learning Engine") delivers student-facing content browsing, a lesson viewer, lesson
completion, learning progress, "continue learning", "recently viewed", and student + admin progress
dashboards (FR-PROGRESS-01, STUDENT-30, UX-07). It builds on the Sprint 2 content hierarchy
(ADR-0012). Several design questions have to be settled: whether an enrollment/entitlement gate is
required, how "published" content becomes visible to students given per-node statuses, how progress
is recorded, and which learning events are audited.

## Decision

- **No enrollment/entitlement gate in Sprint 3.** FR-COURSE-01's "show only active course
  entitlements" is a commerce/payments concern (later sprint) and is not in the Sprint 3 scope list.
  Any authenticated student may browse and learn any fully-published course. `LessonProgress` is
  created lazily as a student views/completes lessons — "continue learning" is simply the set of
  courses a student has started, not a formal enrollment.
- **Published-chain visibility.** Because Sprint 2's publish does not cascade (each node's status is
  independent, ADR-0012), a lesson is student-visible only when the lesson **and every ancestor**
  (module, topic, subject, course) is `PUBLISHED`. Catalog/curriculum queries filter every level to
  `PUBLISHED`; the lesson-content and progress endpoints verify the full ancestor chain and return
  404 otherwise (a draft/archived node is indistinguishable from "not found" to a student).
- **Progress model.** A single `LessonProgress` row per `(userId, lessonId)` carries `firstViewedAt`,
  `lastViewedAt`, and a nullable `completedAt`. Viewing records/updates the view timestamps;
  completing stamps `completedAt`. Higher-level completion (course/subject/topic/module %) is
  **derived** from lesson progress, never stored. `courseId` is denormalized onto the row so
  course-level aggregation and the admin dashboard avoid four-level joins.
- **Read/write split & routes.** `GET /catalog/*` serves published content (side-effect-free);
  `POST /learning/lessons/:id/view` records a view; `POST /learning/lessons/:id/complete` completes.
  Student progress endpoints operate only on `req.user.id`. The admin dashboard is read-only and
  gated by a new `progress:read` permission.
- **Permissions.** `content:read` (granted to every role) authorises reading published content;
  `progress:read` (ADMINISTRATOR only in Sprint 3) authorises the admin progress dashboard. Own-
  progress endpoints require authentication only and are self-scoped.
- **Auditing.** Lesson **completion** is audited (`learning.lesson_completed`) as a meaningful
  learning event. Lesson **views** are NOT audited — they are high-frequency and already recorded in
  `lesson_progress` itself; auditing every view would flood the append-only audit log. Admin
  dashboard reads are not audited (they expose only aggregate progress, not sensitive PII).

## Consequences

- The moment payments/enrollment ships, an entitlement check will need to wrap the catalog/learning
  endpoints; the current code centralises visibility in the catalog/progress services, so that gate
  has one place to go.
- Completion is an explicit student action in Sprint 3. FR-CONTENT-02's "completion recorded only
  after its configured condition is met" (e.g. video watched %) is deferred — there is no
  per-lesson completion-condition config yet.
- Because course/module/etc. completion is derived, editing the published lesson set of a course
  changes every learner's computed percentage retroactively; there is no historical progress
  snapshot (consistent with the no-versioning decision in ADR-0012).

## Alternatives Considered

- **Formal enrollment table now**: rejected — entitlement belongs with commerce; adding it here
  would pull payment/access-period concerns into an out-of-scope sprint.
- **Store rolled-up course/module completion**: rejected — denormalised completion percentages drift
  when content changes; deriving from lesson progress is always correct, and the denormalised
  `courseId` already makes the aggregation queries cheap.
- **Record a view as a side effect of GET lesson content**: rejected — keeps GET side-effect-free
  and cacheable; the explicit `POST /view` also makes "recently viewed" a clean, testable event.
