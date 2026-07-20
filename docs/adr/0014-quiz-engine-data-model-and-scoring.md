# ADR-0014: Quiz Engine — Data Model, Scoring and Idempotency

Status: Accepted
Date: 2026-07-21
Deciders: Engineering (Sprint 4)

## Context

Sprint 4 ("Assessment & Quiz Engine") delivers a question bank, quiz authoring, timed attempts
with autosave/resume, automatic scoring with negative marking, and admin monitoring/results
(ASSESS-09, SRS-02 FR-QUIZ/FR-REPORT). This is the first sprint with meaningful transactional
integrity requirements — a submitted score must never change, a quiz must never be double-scored
under concurrent requests, and a timed-out attempt must close itself out even if nobody is watching.

## Decisions

**Question categorization reuses the existing curriculum taxonomy.** `Question.subjectId` is a
nullable FK into the Sprint 2 `Subject` model rather than a new parallel "Question Category"
entity. A separate taxonomy would immediately diverge from the Category→Course→Subject→Topic
hierarchy content already lives in. Tags are a flat `String[]` column (Postgres native array), not
a normalized `Tag` entity — sufficient for filtering, avoids a second tag-management CRUD surface
this sprint.

**Question and Quiz reuse the Sprint 2 `ContentStatus` enum** (DRAFT/PUBLISHED/ARCHIVED) via the
same `assertValidStatusTransition` state machine as content (ADR-0012), rather than inventing a
parallel status model. `Quiz` gets its own `content:publish`-equivalent gate: `quiz:publish` is
separate from `quiz:manage`, mirroring the content:manage/content:publish author/publisher split.

**Question types are limited to server-gradable formats**: `SINGLE_CHOICE`, `MULTIPLE_CHOICE`,
`TRUE_FALSE`. Free-text/descriptive questions are out of scope — "Automatic Evaluation" is a hard
Sprint 4 requirement and manual/subjective grading belongs to the excluded Creative Assignment
workflow. `MULTIPLE_CHOICE` scoring is all-or-nothing (the selected set must exactly equal the
correct set) — no partial credit this sprint.

**A `QuizAttempt` freezes its own quiz composition and marking rules at start time.** `questionSnapshot`
(ordered `{questionId, sectionId, marks}[]`, computed once from live `QuizQuestion` rows) and
`optionOrder` (`{questionId: optionId[]}`, the frozen shuffle) are stored as JSON on the attempt.
`passingScorePercent`, `negativeMarkingEnabled` and `negativeMarksPerWrong` are copied onto the
attempt row itself at the same moment. Consequence: editing a quiz's marks, passing score, or
negative-marking settings, or reassigning its questions, never retroactively changes an attempt
that is already in progress or submitted — only new attempts see the new configuration. Shuffling
(`shuffleQuestions`/`shuffleOptions`) happens once at attempt start and is frozen into these same
fields, so resume/autosave always see a stable order.

**Correctness is evaluated once, at submission, against live `QuestionOption.isCorrect` flags, and
persisted permanently.** Unlike the frozen composition/marks above, the answer key itself is _not_
snapshotted at attempt start — grading reads whatever is live in the DB the moment the attempt is
scored (manual submit or auto-submit-on-timeout), and the resulting `isCorrect`/`marksAwarded` on
each `QuizAttemptAnswer` are never recomputed afterward. This matches every other content-editing
pattern in this codebase (ADR-0012: "editing published content mutates it in place, no
versioning") while still giving the one guarantee that actually matters operationally: **a
submitted score is permanently fixed the instant it's computed.** Editing a question's correct
answer between two students' attempts naturally means they're graded against different answer
keys at the moment each of them submits — this is standard behavior for every quiz platform and is
not tracked as debt.

**Submission idempotency is structural, not a cached idempotency key.** A `QuizAttempt` can only
transition `IN_PROGRESS → SUBMITTED`/`AUTO_SUBMITTED` once; the submit endpoint guards this with an
optimistic-lock `updateMany({where: {id, status: "IN_PROGRESS", version}})` inside a transaction.
If the guarded update affects zero rows (a concurrent request already finalized it), the handler
re-reads and returns the already-persisted result instead of erroring or rescoring — so retries,
double-clicks, and races between a manual submit and an auto-submit-on-timeout check all converge
on exactly one scoring computation and an identical response. ADR-0002's `Idempotency-Key` header
contract is still accepted on the submit endpoint for client-side retry correlation, but the
state-machine guard — not the header — is what actually prevents double-scoring; it also protects
paths (auto-submit) that never carry a client-supplied key.

**Auto-submit-on-timeout is access-triggered ("lazy"), not a background sweep.** No job queue
exists yet (Sprint 0 deferred it; TD-005/BullMQ is still Sprint 6 scope). A shared
`finalizeIfExpired()` check runs at the top of every attempt read/write path (resume, autosave,
submit, admin single-attempt detail) — if `now > expiresAt` and the attempt is still
`IN_PROGRESS`, it is scored and closed as `AUTO_SUBMITTED` (with `submittedAt` set to `expiresAt`,
not "now", so the student isn't penalized for how long it took someone to look) before the read/write
proceeds. Admin's attempt _list_ endpoint stays side-effect-free (ADR-0013's read/write split) and
instead reports a derived `effectivelyExpired` flag for display, rather than mutating on a bulk
read. Consequence, tracked as TD-021: an expired attempt that nobody ever accesses again stays
`IN_PROGRESS` in storage indefinitely. Acceptable for Sprint 4; a real background sweep is future
work once a job queue exists.

**Unanswered questions are never penalized.** Negative marking applies only to a question with a
saved answer whose selected-option set does not exactly match the correct set; a question with no
saved answer scores 0 regardless of `negativeMarkingEnabled`. `obtainedMarks` is not clamped to
zero at the attempt level (a heavily negative-marked attempt can show a negative total) — reported
transparently rather than floored, since flooring would hide from the student exactly how many
marks negative marking cost them.

**Re-attempts are unlimited and each is a new `QuizAttempt` row.** No `maxAttempts` cap this
sprint (not in the FR list); attempt history is simply every row for `(userId, quizId)`. Starting a
new attempt while a non-expired `IN_PROGRESS` one already exists returns that existing attempt
(resume-by-restarting) rather than creating a duplicate.

## Consequences

- Reporting/scoring math lives in one place (`ScoringService`), fed by the frozen `questionSnapshot`
  - live option correctness — it never needs to re-derive quiz configuration from possibly-since-
    edited `Quiz`/`QuizQuestion` rows.
- `QuizAttempt` carries some intentional denormalization (`passingScorePercent`,
  `negativeMarkingEnabled`, `negativeMarksPerWrong`, `totalMarks`) that duplicates `Quiz` fields by
  design — this is the mechanism that makes attempts immune to later quiz edits, not an oversight.
- TD-021 (lazy auto-submit) means admin "Attempt Monitoring" must call the shared expiry check
  (or read the derived flag) rather than trusting `status` alone when it matters that an attempt is
  truly closed out.
- Large quizzes (500+ questions) are read via a single indexed `QuizQuestion` query
  (`@@index([quizId])`) at attempt-start, not N+1 lookups; autosave is a single indexed upsert on
  `(attemptId, questionId)` regardless of quiz size.

## Alternatives Considered

- **Full question/option content snapshotting into the attempt** (freezing text, not just
  correctness): rejected as disproportionate scope for this sprint — the marks/composition/shuffle
  freeze already solves the guarantees that matter (stable resume UX, fixed scoring math); content
  editing following the existing no-versioning content philosophy is consistent, not a gap.
- **A generic `Idempotency-Key` cache table** (store request key → response, replay on match):
  rejected in favor of the structural state-machine guard, which is strictly stronger (protects
  every caller, including the header-less auto-submit path) and needs no extra table/TTL policy.
- **Background cron/BullMQ sweep for auto-submit**: rejected for this sprint — no job queue exists
  yet and adding one is a bigger infra lift than the lazy/access-triggered check, which is fully
  correct for every path a student or admin actually uses to look at an attempt.
- **A normalized `QuestionCategory`/`Tag` entity**: rejected — reuses `Subject` and a flat array
  respectively, per the "Decisions" section above; revisit only if tag/category management grows
  requirements a flat column can't express (autocomplete-from-existing-tags, per-category RBAC).
