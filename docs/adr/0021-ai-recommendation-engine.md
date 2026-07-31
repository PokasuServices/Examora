# ADR-0021: AI Recommendation Engine

Status: Accepted (2026-07-31)

## Context

Sprint 11's kickoff asks for a personalization layer — course/quiz/assignment/learning-path
recommendations, "Continue Learning," "Similar Courses," and "Related Community Discussions" — built
"using existing platform data only" and reusing existing services, with external AI services and
duplicated business logic both explicitly out of scope. "AI Recommendation Engine" is the sprint's
name, but the concrete requirements (rules, scoring, ranking, explainable metadata) describe a
rule-based/heuristic personalization engine, not a model-backed one — consistent with "Do not
introduce external AI services."

The kickoff also states "Do not modify the roadmap." The currently-documented Sprint 11 in
`SPRINT_BACKLOG.md` was "Growth Modules, Full Admin & Creative Gallery" — different content. Per
explicit user direction (2026-07-31), this ADR and the Sprint Backlog's own Sprint 11 entry are
updated to describe what was actually built; `IMPLEMENTATION_ROADMAP.md`'s phase structure and
sequencing are left untouched, and "Growth Modules..."/"Scoring, Reports & Recommendations v0"
placement is intentionally left unresolved for a future sprint (see D-56).

## Decisions

### 1. Rule-based scoring, not machine learning — no external AI services

Every recommendation is produced by a deterministic function over existing Prisma data: filter to
eligible candidates (rules), compute a numeric score from weighted signals (scoring), sort and
truncate (ranking), and attach a plain-English `reason` string (explainable metadata) describing
which signal(s) drove the result — e.g. "Because you're enrolled in Product Design" or "Matches your
recent quiz activity." No embeddings, no third-party AI API calls, no model training/inference. This
directly satisfies "Do not introduce external AI services" while still meeting every named
requirement (Recommendation Rules, Recommendation Scoring, Ranking Engine, Explainable Recommendation
Metadata).

### 2. `RecommendationsModule` is a leaf module reusing five existing services outright

Two "Recommendation Engine" deliverables are **already fully implemented** by existing Sprint 3/10
services and are exposed here as thin delegates, not reimplemented:

- **Continue Learning** → `ProgressService.listContinueLearning()` (Sprint 3) — courses started but
  not finished, most-recent-activity first, each with its `nextLesson` pointer already computed.
- The **Learning Progress / Quiz Performance / Assignment Performance** personalization _sources_ the
  kickoff lists → `StudentAnalyticsService` (Sprint 10) already computes exactly these three
  summaries; the recommendation services call it directly rather than re-querying Prisma.

The remaining recommendation types are new, small, rule-based services that reuse existing catalog/
search services for their candidate sets rather than querying Prisma tables those services already
own:

| Recommendation                | Candidate source (reused)                                           | Rule/signal                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Course Recommendations        | `CatalogService.listPublishedCourses()`                             | Category affinity from active enrollments, excludes already-enrolled                                                         |
| Similar Courses               | `CatalogService.listPublishedCourses({ categoryId })`               | Same category as a reference course (defaults to the student's most-active enrollment), excludes itself and already-enrolled |
| Learning Path Recommendations | `CatalogService.listPublishedCourses()` + `StudentAnalyticsService` | Next course in an in-progress category once the current one nears completion                                                 |
| Quiz Recommendations          | `QuizCatalogService.listPublishedQuizzes()`                         | Subjects tied to active enrollments, excludes already-attempted                                                              |
| Assignment Recommendations    | `AssignmentCatalogService.listPublished()`                          | Subjects tied to active enrollments, excludes already-submitted                                                              |
| Related Community Discussions | `CommunitySearchService.search()`                                   | Keyword search seeded with the student's enrolled course/subject titles                                                      |

Mentor Feedback (a listed personalization _source_) is read via a new
`MentorFeedbackService.listRecentForStudent()` method (the existing `list()` requires an
assigned-mentor-or-admin actor, which a student reading their own feedback is neither) — its
_presence/recency_, not its text content, is used as a light engagement signal (no NLP, consistent
with decision #1). User Interests (the other listed source) is **derived**, not a new stored
preference: category affinity computed from enrollment + completion history, exactly like the Course
Recommendations rule above — adding a self-declared "interests" field/UI would be a new feature not
named anywhere in the kickoff's scope list.

`RecommendationsModule` imports `LearningModule`, `AssessmentModule`, `AssignmentsModule`,
`CommunityModule`, `MentoringModule`, and `AnalyticsModule`. Three modules gain new `exports` entries
to make this possible (`CommunitySearchService` from `CommunityModule`, `MentorFeedbackService` from
`MentoringModule`, `StudentAnalyticsService` from `AnalyticsModule`) — the same
export-what's-missing pattern used in Sprint 10 for `MentoringModule`.

### 3. Two permission codes, matching ADR-0020's `:own`/admin split

- `recommendations:read:own` — baseline (every authenticated user gets their own recommendations).
- `recommendations:admin` — ADMINISTRATOR only, gates the feature-flag management endpoints.

No mentor-scoped tier: recommendations are inherently per-student personalization, and mentors
already have their own analytics dashboards (ADR-0020) for the "guide a student" use case.

### 4. Feature flags are a new, minimal, admin-managed Prisma model

No feature-flag mechanism exists anywhere in the codebase yet. A `RecommendationFeatureFlag` model
(`key` unique string, `isEnabled` boolean default true, `updatedById`, timestamps) lets an admin
disable a specific recommendation type platform-wide (e.g. turn off Community Discussions without a
deploy) without adding a general-purpose feature-flag system — scoped tightly to this sprint's actual
need, matching `ScheduledReport`'s precedent of a small new model in service of one feature rather
than a speculative general-purpose one.

### 5. No persistence of computed recommendations

Recommendations are computed on every request, not cached or stored — consistent with ADR-0020's
"read-only aggregation, no new business logic" philosophy. Personalization inputs change constantly
(a new enrollment, a completed lesson) and staleness would be worse than a few extra Prisma queries at
this data volume; a caching layer is explicitly deferred (performance optimization is out of scope
for this sprint) — see TD-043.

### 6. Frontend: a dedicated `/recommendations` page (web), plus a `/feature-flags` admin page

Following ADR-0020's placement pattern: `apps/web/src/app/recommendations` surfaces every
recommendation type behind labeled sections; `apps/admin/src/app/feature-flags` lets an admin toggle
each recommendation type. No changes to `apps/admin`'s existing analytics pages — recommendations are
a student-facing feature with an admin control surface, not an admin dashboard.

## Consequences

- Every recommendation type traces to a named, real signal — no black-box scoring.
- Five of seven recommendation surfaces are majority-reuse (delegate or thin rule layer over an
  existing catalog/search service); only the scoring/ranking utilities and the feature-flag CRUD are
  net-new business logic.
- No recommendation-quality tuning infrastructure (A/B testing, click-through tracking) exists yet —
  acceptable for a v0 rule-based engine; tracked as TD-044 if/when recommendation effectiveness needs
  measuring.

## Alternatives Considered

- **Collaborative filtering / embeddings-based similarity** — rejected outright by "Do not introduce
  external AI services" and by the platform's current data volume (too sparse for meaningful
  collaborative signals).
- **Persisted/cached recommendation rows refreshed by a cron job** — rejected for this sprint
  (performance optimization out of scope); on-demand computation is simpler and always fresh.
- **Folding recommendations into `AnalyticsModule`** — rejected: recommendations are prescriptive
  ("do this next"), analytics is descriptive ("here's what happened"); keeping them separate modules
  keeps each one's own leaf-dependency graph legible.
